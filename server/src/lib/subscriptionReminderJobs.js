const nodemailer = require('nodemailer');
const { prisma } = require('./prisma');

function parseExpiryDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildReminderSendDate(expiresAt) {
  const sendAt = new Date(expiresAt);
  sendAt.setDate(sendAt.getDate() - 15);
  return sendAt > new Date() ? sendAt : new Date();
}

async function getTargetRecipient(entityType, entityId) {
  if (entityType === 'specialist') {
    const specialist = await prisma.specialist.findUnique({ where: { id: entityId }, include: { user: true } });
    return specialist?.user?.email || null;
  }

  const client = await prisma.client.findUnique({ where: { id: entityId }, include: { user: true } });
  return client?.user?.email || null;
}

async function syncSubscriptionReminderJob({ entityType, entityId, subscription }) {
  await prisma.subscriptionReminderJob.updateMany({
    where: {
      entityType,
      entityId,
      status: { in: ['pending', 'processing', 'failed'] },
    },
    data: { status: 'cancelled' },
  });

  if (!subscription || subscription.status !== 'active') {
    return null;
  }

  const expiresAt = parseExpiryDate(subscription.expires);
  if (!expiresAt) return null;

  const recipientEmail = await getTargetRecipient(entityType, entityId);
  const sendAt = buildReminderSendDate(expiresAt);

  return prisma.subscriptionReminderJob.upsert({
    where: {
      entityType_entityId_jobType_subscriptionExpires: {
        entityType,
        entityId,
        jobType: 'expiry_15d',
        subscriptionExpires: expiresAt,
      },
    },
    create: {
      entityType,
      entityId,
      jobType: 'expiry_15d',
      recipientEmail,
      sendAt,
      subscriptionExpires: expiresAt,
      status: 'pending',
      payload: subscription,
    },
    update: {
      recipientEmail,
      sendAt,
      status: 'pending',
      attempts: 0,
      lastError: null,
      sentAt: null,
      payload: subscription,
    },
  });
}

async function sendReminderEmail(job) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !job.recipientEmail) {
    throw new Error('Missing SMTP configuration or recipient email.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: job.recipientEmail,
    subject: 'Proyecto Gigi — Tu suscripción vence en 15 días',
    html: `<p>Tu suscripción a Proyecto Gigi vence el <strong>${job.subscriptionExpires.toLocaleDateString('es-ES')}</strong>.</p>
           <p>Renuévala en <a href="${process.env.FRONTEND_URL}/settings">Configuración</a> para seguir sin interrupciones.</p>`,
  });
}

async function processDueSubscriptionReminders(limit = 20) {
  const jobs = await prisma.subscriptionReminderJob.findMany({
    where: {
      status: { in: ['pending', 'failed'] },
      sendAt: { lte: new Date() },
    },
    orderBy: { sendAt: 'asc' },
    take: limit,
  });

  for (const job of jobs) {
    const claim = await prisma.subscriptionReminderJob.updateMany({
      where: { id: job.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'processing' },
    });
    if (!claim.count) continue;

    try {
      await sendReminderEmail(job);
      await prisma.subscriptionReminderJob.update({
        where: { id: job.id },
        data: {
          status: 'sent',
          attempts: { increment: 1 },
          sentAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await prisma.subscriptionReminderJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          lastError: error.message,
          sendAt: new Date(Date.now() + (60 * 60 * 1000)),
        },
      });
      console.error('Subscription reminder job failed:', error);
    }
  }
}

function startSubscriptionReminderWorker(intervalMs = 60000) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processDueSubscriptionReminders();
    } finally {
      running = false;
    }
  };

  tick().catch((error) => console.error('Reminder worker bootstrap error:', error));
  return setInterval(() => {
    tick().catch((error) => console.error('Reminder worker error:', error));
  }, intervalMs);
}

module.exports = {
  syncSubscriptionReminderJob,
  processDueSubscriptionReminders,
  startSubscriptionReminderWorker,
};