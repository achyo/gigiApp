const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, paginateQuery, paginatedResponse } = require('../middleware/auth');
const { buildAdminLearningOverview } = require('../lib/progressMetrics');
const { recordAdminAudit } = require('../lib/adminAudit');

router.get('/stats', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const [users, specialists, clients, objects, categories, activities, assignments, learningClients] = await Promise.all([
      prisma.user.count(),
      prisma.specialist.count(),
      prisma.client.count(),
      prisma.object.count(),
      prisma.category.count(),
      prisma.activity.count(),
      prisma.assignment.count({ where: { isActive: true } }),
      prisma.client.findMany({
        include: {
          user: { select: { id: true, name: true, email: true, active: true } },
          specialist: { include: { user: { select: { id: true, name: true, email: true, active: true } } } },
          groups: { select: { id: true, name: true, color: true } },
          assignments: {
            include: {
              activity: {
                include: {
                  activityObjects: {
                    include: { object: { select: { id: true, name: true, em: true } } },
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
              stepProgress: { select: { id: true, completedAt: true, timeMs: true } },
              results: { select: { isCorrect: true, timeMs: true, createdAt: true } },
            },
            orderBy: [{ progressUpdatedAt: 'desc' }, { assignedAt: 'desc' }],
          },
        },
      }),
    ]);
    const learning = buildAdminLearningOverview(learningClients);
    res.json({
      success: true,
      data: {
        users,
        specialists,
        clients,
        objects,
        categories,
        activities,
        assignments,
        learning: {
          summary: learning.summary,
          attentionStudents: learning.attentionStudents,
          leadingStudents: learning.leadingStudents,
        },
      },
    });
  } catch(e){ next(e); }
});

router.get('/pending-approvals', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const [objects, categories] = await Promise.all([
      prisma.object.findMany({ where: { status: 'pending' }, include: { owner: { select:{name:1} } } }),
      prisma.category.findMany({ where: { status: 'pending' }, include: { owner: { select:{name:1} } } }),
    ]);
    res.json({ success: true, data: { objects, categories } });
  } catch(e){ next(e); }
});

router.get('/audit-logs', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { page, limit, skip, take } = paginateQuery(req.query);
    const { action, entity_type } = req.query;
    const where = {
      ...(action ? { action } : {}),
      ...(entity_type ? { entityType: entity_type } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e) { next(e); }
});

router.patch('/approve/:type/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    if (!['object', 'category'].includes(req.params.type)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE' } });
    }
    const model = req.params.type === 'object' ? prisma.object : prisma.category;
    const updated = await model.update({ where: { id: req.params.id }, data: { status: 'approved', ownerId: null } });
    await recordAdminAudit({
      user: req.user,
      action: 'approval.approve',
      entityType: req.params.type,
      entityId: req.params.id,
      message: `${req.params.type} aprobado.`,
    });
    res.json({ success: true, data: updated });
  } catch(e){ next(e); }
});

router.patch('/reject/:type/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    if (!['object', 'category'].includes(req.params.type)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE' } });
    }
    const model = req.params.type === 'object' ? prisma.object : prisma.category;
    const updated = await model.update({ where: { id: req.params.id }, data: { status: 'rejected', rejectedNote: req.body.note } });
    await recordAdminAudit({
      user: req.user,
      action: 'approval.reject',
      entityType: req.params.type,
      entityId: req.params.id,
      message: `${req.params.type} rechazado.`,
      diff: { note: req.body.note || null },
    });
    res.json({ success: true, data: updated });
  } catch(e){ next(e); }
});

module.exports = router;
