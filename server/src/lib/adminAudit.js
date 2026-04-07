const { prisma } = require('./prisma');

async function recordAdminAudit({ user, action, entityType, entityId = null, message = null, diff = null }) {
  if (!user || user.role !== 'admin') return null;

  try {
    return await prisma.auditLog.create({
      data: {
        actorId: user.sub || null,
        actorRole: user.role,
        action,
        entityType,
        entityId,
        message,
        diff,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
    return null;
  }
}

module.exports = {
  recordAdminAudit,
};