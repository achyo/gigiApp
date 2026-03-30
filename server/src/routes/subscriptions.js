const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');

// POST /api/subscriptions  — activate/renew a subscription
router.post('/', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { entity_id, entity_type, plan, billing, method } = req.body;
    // Calculate expiry
    const expires = new Date();
    expires.setMonth(expires.getMonth() + (billing === 'year' ? 12 : 1));

    if (entity_type === 'specialist') {
      const s = await prisma.specialist.update({
        where: { id: entity_id },
        data: { subscription: { plan, billing, status: 'active', expires: expires.toISOString().split('T')[0] } },
      });
      // Schedule expiry email (in production use a queue; here we simulate)
      _scheduleExpiryAlert(entity_id, 'specialist', expires);
      return res.json({ success: true, data: s });
    }
    if (entity_type === 'client') {
      const c = await prisma.client.update({
        where: { id: entity_id },
        data: { subscription: { plan, billing, status: 'active', expires: expires.toISOString().split('T')[0] } },
      });
      _scheduleExpiryAlert(entity_id, 'client', expires);
      return res.json({ success: true, data: c });
    }
    res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY_TYPE' } });
  } catch(e){ next(e); }
});

// GET /api/subscriptions/status/:entityType/:entityId
router.get('/status/:entityType/:entityId', authenticateJWT, async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    let sub = null;
    if (entityType === 'specialist') {
      const s = await prisma.specialist.findUnique({ where:{ id:entityId } });
      sub = s?.subscription;
    } else {
      const c = await prisma.client.findUnique({ where:{ id:entityId } });
      sub = c?.subscription;
    }
    if (!sub) return res.json({ success: true, data: { status: 'none' } });

    const now = new Date();
    const exp = new Date(sub.expires);
    const diffDays = (exp - now) / (1000*60*60*24);
    let status = sub.status;
    if (status === 'active' && diffDays < 0 && diffDays > -15) status = 'grace';
    if (diffDays < -15) status = 'expired';

    res.json({ success: true, data: { ...sub, status, daysLeft: Math.ceil(diffDays) } });
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
        const transporter = nodemailer.createTransporter({
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
