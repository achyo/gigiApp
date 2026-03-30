const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, scopeFilter, paginateQuery, paginatedResponse } = require('../middleware/auth');

// GET /api/assignments/client/:clientId
router.get('/client/:clientId', authenticateJWT, async (req, res, next) => {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { clientId: req.params.clientId, isActive: true },
      include: {
        activity: {
          include: {
            activityObjects: {
              include: { object: { include: { representations: true } } },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
    res.json({ success: true, data: assignments });
  } catch (e) { next(e); }
});

// GET /api/assignments
router.get('/', authenticateJWT, scopeFilter('assignments'), async (req, res, next) => {
  try {
    const { page, limit, skip, take } = paginateQuery(req.query);
    const [data, total] = await Promise.all([
      prisma.assignment.findMany({
        where: req.scope, skip, take,
        include: { activity: true, client: true },
        orderBy: { assignedAt: 'desc' },
      }),
      prisma.assignment.count({ where: req.scope }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e) { next(e); }
});

// POST /api/assignments
router.post('/', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const { activity_id, client_id, is_active = true } = req.body;
    const assignment = await prisma.assignment.create({
      data: { activityId: activity_id, clientId: client_id, isActive: is_active },
      include: { activity: true, client: true },
    });
    res.status(201).json({ success: true, data: assignment });
  } catch (e) { next(e); }
});

// Bulk assign: POST /api/assignments/bulk
router.post('/bulk', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const { activity_id, client_ids, group_ids, assign_all, specialist_id } = req.body;
    let clientIds = client_ids || [];

    if (group_ids?.length) {
      const groups = await prisma.group.findMany({
        where: { id: { in: group_ids } }, include: { clients: { select: { id: true } } },
      });
      groups.forEach(g => { clientIds = [...new Set([...clientIds, ...g.clients.map(c => c.id)])]; });
    }
    if (assign_all) {
      const specId = specialist_id || req.user.specialist_id;
      const clients = await prisma.client.findMany({ where: { specialistId: specId }, select: { id: true } });
      clientIds = clients.map(c => c.id);
    }

    const created = await prisma.$transaction(
      clientIds.map(cid =>
        prisma.assignment.upsert({
          where: { activityId_clientId: { activityId: activity_id, clientId: cid } },
          create: { activityId: activity_id, clientId: cid, isActive: true },
          update: { isActive: true },
        })
      )
    );
    res.status(201).json({ success: true, data: created });
  } catch (e) { next(e); }
});

// PATCH /api/assignments/:id
router.patch('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const updated = await prisma.assignment.update({
      where: { id: req.params.id }, data: { isActive: is_active },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// POST /api/assignments/:id/complete
router.post('/:id/complete', authenticateJWT, async (req, res, next) => {
  try {
    const updated = await prisma.assignment.update({
      where: { id: req.params.id }, data: { completedAt: new Date() },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

module.exports = router;
