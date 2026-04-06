const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');

const VALID_ENTITY_TYPES = new Set(['specialist', 'client']);
const VALID_PLANS = new Set(['basic', 'premium']);
const VALID_BILLING = new Set(['month', 'year']);
const VALID_METHODS = new Set(['card', 'paypal', 'bizum']);

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
    const { entity_id, entity_type, plan, billing, method } = req.body;
    if (!VALID_ENTITY_TYPES.has(entity_type)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY_TYPE' } });
    }
    if (!VALID_PLANS.has(plan) || !VALID_BILLING.has(billing) || !VALID_METHODS.has(method)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SUBSCRIPTION_REQUEST' } });
    }

    const target = await loadSubscriptionTarget(entity_type, entity_id);
    if (!target) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }
    if (!canAccessSubscriptionTarget(req.user, entity_type, target)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    // Calculate expiry
    const expires = new Date();
    expires.setMonth(expires.getMonth() + (billing === 'year' ? 12 : 1));
    const subscription = {
      plan,
      billing,
      method,
      status: 'active',
      expires: expires.toISOString().split('T')[0],
    };

    if (entity_type === 'specialist') {
      const s = await prisma.specialist.update({
        where: { id: entity_id },
        data: { subscription },
      });
      // Schedule expiry email (in production use a queue; here we simulate)
      _scheduleExpiryAlert(entity_id, 'specialist', expires);
      return res.json({ success: true, data: serializeSubscription(s, 'specialist') });
    }

    const c = await prisma.client.update({
      where: { id: entity_id },
      data: { subscription },
    });
    _scheduleExpiryAlert(entity_id, 'client', expires);
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

// Internal: schedule expiry warning email 15 days before
function _scheduleExpiryAlert(entityId, entityType, expiresDate) {
  const alertDate = new Date(expiresDate);
  alertDate.setDate(alertDate.getDate() - 15);
  const delay = alertDate - new Date();
  if (delay > 0 && delay < 30 * 24 * 60 * 60 * 1000) { // only schedule if within 30d
    setTimeout(async () => {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST, port: process.env.SMTP_PORT,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        // Fetch email from DB
        let email = '';
        if (entityType === 'specialist') {
          const s = await prisma.specialist.findUnique({ where:{id:entityId}, include:{user:true} });
          email = s?.user?.email;
        } else {
          const c = await prisma.client.findUnique({ where:{id:entityId}, include:{user:true} });
          email = c?.user?.email;
        }
        if (email) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'Proyecto Gigi — Tu suscripción vence en 15 días',
            html: `<p>Tu suscripción a Proyecto Gigi vence el <strong>${expiresDate.toLocaleDateString('es-ES')}</strong>.</p>
                   <p>Renuévala en <a href="${process.env.FRONTEND_URL}/settings/subscription">Mi suscripción</a> para seguir sin interrupciones.</p>`,
          });
        }
      } catch(e){ console.error('Expiry email error:', e); }
    }, delay);
  }
}

module.exports = router;
