const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, scopeFilter, paginateQuery, paginatedResponse, canModify } = require('../middleware/auth');

// GET /api/assignments/client/:clientId
router.get('/client/:clientId', authenticateJWT, async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.clientId }, select: { id: true, specialistId: true, userId: true } });
    if (!client) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (req.user.role === 'client' && client.id !== req.user.client_id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    if (req.user.role === 'specialist' && client.specialistId !== req.user.specialist_id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

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
        include: {
          activity: {
            include: {
              activityObjects: {
                include: { object: { select: { id: true, em: true, name: true } } },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          client: true,
        },
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
    const [activity, client] = await Promise.all([
      prisma.activity.findUnique({ where: { id: activity_id } }),
      prisma.client.findUnique({ where: { id: client_id } }),
    ]);
    if (!activity || !client) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, activity)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });

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
    const { activity_id, client_ids, group_ids, assign_all, specialist_id, replace_existing } = req.body;
    const activity = await prisma.activity.findUnique({ where: { id: activity_id } });
    if (!activity) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Actividad no encontrada.' } });
    }
    if (!canModify(req.user, activity)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const targetSpecialistId = specialist_id || activity.specialistId || req.user.specialist_id;
    let clientIds = [...new Set(client_ids || [])];
    let resolvedGroupIds = [];

    if (group_ids?.length) {
      const groups = await prisma.group.findMany({
        where: {
          id: { in: group_ids },
          ...(targetSpecialistId ? { specId: targetSpecialistId } : {}),
        },
        include: { clients: { select: { id: true } } },
      });
      resolvedGroupIds = groups.map(group => group.id);
      groups.forEach(g => { clientIds = [...new Set([...clientIds, ...g.clients.map(c => c.id)])]; });
    }
    if (assign_all) {
      const clients = await prisma.client.findMany({ where: { specialistId: targetSpecialistId }, select: { id: true } });
      clientIds = clients.map(c => c.id);
    } else if (clientIds.length) {
      const clients = await prisma.client.findMany({
        where: {
          id: { in: clientIds },
          ...(targetSpecialistId ? { specialistId: targetSpecialistId } : {}),
        },
        select: { id: true },
      });
      clientIds = clients.map(c => c.id);
    }

    const audience = {
      mode: assign_all ? 'all' : (resolvedGroupIds.length ? 'groups' : 'clients'),
      specialistId: targetSpecialistId || null,
      clientIds: assign_all ? [] : clientIds,
      groupIds: assign_all ? [] : resolvedGroupIds,
    };

    const operations = [
      prisma.activity.update({
        where: { id: activity_id },
        data: { audience },
      }),
    ];
    if (replace_existing) {
      operations.push(
        prisma.assignment.updateMany({
          where: { activityId: activity_id },
          data: { isActive: false },
        })
      );
    }

    clientIds.forEach(cid => {
      operations.push(
        prisma.assignment.upsert({
          where: { activityId_clientId: { activityId: activity_id, clientId: cid } },
          create: { activityId: activity_id, clientId: cid, isActive: true },
          update: { isActive: true },
        })
      );
    });

    const result = operations.length ? await prisma.$transaction(operations) : [];
    const created = replace_existing ? result.slice(2) : result.slice(1);
    res.status(201).json({ success: true, data: created });
  } catch (e) { next(e); }
});

// PATCH /api/assignments/:id
router.patch('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { activity: true, client: true },
    });
    if (!assignment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (req.user.role === 'client' && assignment.clientId !== req.user.client_id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    if (req.user.role === 'specialist' && assignment.client.specialistId !== req.user.specialist_id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const updated = await prisma.assignment.update({
      where: { id: req.params.id }, data: { isActive: is_active },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// POST /api/assignments/:id/complete
router.post('/:id/complete', authenticateJWT, async (req, res, next) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { client: true },
    });
    if (!assignment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (req.user.role === 'client' && assignment.clientId !== req.user.client_id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    if (req.user.role === 'specialist' && assignment.client.specialistId !== req.user.specialist_id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const updated = await prisma.assignment.update({
      where: { id: req.params.id }, data: { completedAt: new Date() },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

module.exports = router;
