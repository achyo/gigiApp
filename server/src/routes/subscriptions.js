const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');
const { recordAdminAudit } = require('../lib/adminAudit');
const { syncSubscriptionReminderJob } = require('../lib/subscriptionReminderJobs');

const VALID_ENTITY_TYPES = new Set(['specialist', 'client']);
const VALID_PLANS = new Set(['basic', 'premium']);
const VALID_BILLING = new Set(['month', 'year']);
const VALID_METHODS = new Set(['card', 'paypal', 'bizum', 'trial']);
const VALID_STATUSES = new Set(['active', 'inactive', 'trial']);

function buildDefaultExpiryDate(billing) {
  const expires = new Date();
  expires.setMonth(expires.getMonth() + (billing === 'year' ? 12 : 1));
  return expires;
}

function buildTrialExpiryDate() {
  const expires = new Date();
  expires.setDate(expires.getDate() + 15);
  return expires;
}

function parseExpiryDate(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const expires = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(expires.getTime())) return null;
  return expires;
}

async function loadSubscriptionTarget(entityType, entityId) {
  if (entityType === 'specialist') {
    return prisma.specialist.findUnique({
      where: { id: entityId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  return prisma.client.findUnique({
    where: { id: entityId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
}

function canAccessSubscriptionTarget(user, entityType, target) {
  if (user.role === 'admin') return true;
  if (entityType === 'specialist') {
    return user.role === 'specialist' && target.id === user.specialist_id;
  }

  if (user.role === 'specialist') {
    return target.specialistId === user.specialist_id;
  }

  return user.role === 'client' && target.id === user.client_id;
}

function canManageSubscriptionTarget(user, entityType, target) {
  if (user.role === 'admin') {
    return entityType === 'specialist';
  }

  return canAccessSubscriptionTarget(user, entityType, target);
}

function serializeSubscription(target, entityType) {
  return {
    entity_id: target.id,
    entity_type: entityType,
    subscription: target.subscription,
  };
}

// POST /api/subscriptions  — activate/renew a subscription
router.post('/', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { entity_id, entity_type, plan, billing, method, expires, status } = req.body;
    if (!VALID_ENTITY_TYPES.has(entity_type)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY_TYPE' } });
    }
    if (!VALID_PLANS.has(plan) || !VALID_BILLING.has(billing) || !VALID_METHODS.has(method)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SUBSCRIPTION_REQUEST' } });
    }
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SUBSCRIPTION_STATUS' } });
    }

    const target = await loadSubscriptionTarget(entity_type, entity_id);
    if (!target) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }
    if (!canManageSubscriptionTarget(req.user, entity_type, target)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const fallbackExpiryDate = status === 'trial' ? buildTrialExpiryDate() : buildDefaultExpiryDate(billing);
    const expiryDate = expires ? parseExpiryDate(expires) : fallbackExpiryDate;
    if (!expiryDate) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_EXPIRY_DATE' } });
    }

    const subscription = {
      plan,
      billing,
      method,
      status: status || target.subscription?.status || 'inactive',
      expires: expiryDate.toISOString().split('T')[0],
    };

    if (entity_type === 'specialist') {
      const s = await prisma.specialist.update({
        where: { id: entity_id },
        data: { subscription },
      });
      await syncSubscriptionReminderJob({ entityType: 'specialist', entityId: entity_id, subscription });
      await recordAdminAudit({
        user: req.user,
        action: 'subscription.update',
        entityType: 'specialist',
        entityId: entity_id,
        message: `Suscripción de especialista actualizada a ${subscription.status}.`,
        diff: subscription,
      });
      return res.json({ success: true, data: serializeSubscription(s, 'specialist') });
    }

    const c = await prisma.client.update({
      where: { id: entity_id },
      data: { subscription },
    });
    await syncSubscriptionReminderJob({ entityType: 'client', entityId: entity_id, subscription });
    await recordAdminAudit({
      user: req.user,
      action: 'subscription.update',
      entityType: 'client',
      entityId: entity_id,
      message: `Suscripción de cliente actualizada a ${subscription.status}.`,
      diff: subscription,
    });
    return res.json({ success: true, data: serializeSubscription(c, 'client') });
  } catch(e){ next(e); }
});

// GET /api/subscriptions/status/:entityType/:entityId
router.get('/status/:entityType/:entityId', authenticateJWT, async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    if (!VALID_ENTITY_TYPES.has(entityType)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY_TYPE' } });
    }

    const target = await loadSubscriptionTarget(entityType, entityId);
    if (!target) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canAccessSubscriptionTarget(req.user, entityType, target)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const sub = target.subscription;
    if (!sub) return res.json({ success: true, data: { status: 'none' } });

    const now = new Date();
    const exp = new Date(sub.expires);
    const diffDays = (exp - now) / (1000*60*60*24);
    let status = sub.status;
    if (status === 'inactive') {
      return res.json({
        success: true,
        data: {
          entity_id: target.id,
          entity_type: entityType,
          ...sub,
          status,
          daysLeft: Math.ceil(diffDays),
        },
      });
    }
    if (status === 'active' && diffDays < 0 && diffDays > -15) status = 'grace';
    if (diffDays < -15) status = 'expired';

    res.json({
      success: true,
      data: {
        entity_id: target.id,
        entity_type: entityType,
        ...sub,
        status,
        daysLeft: Math.ceil(diffDays),
      },
    });
  } catch(e){ next(e); }
});

module.exports = router;
