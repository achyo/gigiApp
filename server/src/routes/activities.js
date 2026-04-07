// src/routes/activities.js
const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, scopeFilter, canModify, paginateQuery, paginatedResponse } = require('../middleware/auth');

const activityInclude = {
  specialist: { include: { user: { select: { id: 1, name: 1, email: 1 } } } },
  activityObjects: {
    include: { object: { include: { representations: true } } },
    orderBy: { sortOrder: 'asc' },
  },
  assignments: {
    where: { isActive: true },
    include: {
      client: {
        select: {
          id: true,
          childName: true,
          specialistId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  },
};

function normalizeActivityObjects(objects = []) {
  const seen = new Set();
  return objects.filter((item) => {
    if (!item?.object_id || seen.has(item.object_id)) return false;
    seen.add(item.object_id);
    return true;
  });
}

router.get('/', authenticateJWT, scopeFilter('activities'), async (req, res, next) => {
  try {
    const { page, limit, skip, take } = paginateQuery(req.query);
    const search = req.query.search;
    const where = { ...req.scope, ...(search && { title: { contains: search, mode: 'insensitive' } }) };
    const [data, total] = await Promise.all([
      prisma.activity.findMany({
        where, skip, take,
        include: activityInclude,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e) { next(e); }
});

router.get('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const act = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: activityInclude,
    });
    if (!act) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    res.json({ success: true, data: act });
  } catch (e) { next(e); }
});

router.post('/', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const { title, instructions, objects = [], specialist_id } = req.body;
    const specialistId = req.user.specialist_id;
    const targetSpecialistId = specialist_id || specialistId;
    if (!targetSpecialistId) {
      return res.status(400).json({ success: false, error: { code: 'NOT_SPECIALIST' } });
    }
    const act = await prisma.activity.create({
      data: {
        title, instructions,
        specialistId: targetSpecialistId,
        activityObjects: {
          create: objects.map((o, i) => ({
            objectId: o.object_id,
            activityType: o.activity_type || 'show',
            difficultyLevel: o.difficulty_level || 'photo',
            sortOrder: o.sort_order ?? i,
          })),
        },
      },
      include: activityInclude,
    });
    res.status(201).json({ success: true, data: act });
  } catch (e) { next(e); }
});

router.patch('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const act = await prisma.activity.findUnique({ where: { id: req.params.id } });
    if (!act) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, act)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    const { title, instructions, objects, specialist_id } = req.body;
    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(objects)) {
        const nextObjects = normalizeActivityObjects(objects);
        const existingActivityObjects = await tx.activityObject.findMany({
          where: { activityId: req.params.id },
          include: {
            object: { select: { name: true } },
            _count: { select: { results: true } },
          },
          orderBy: { sortOrder: 'asc' },
        });

        const existingByObjectId = new Map(existingActivityObjects.map((item) => [item.objectId, item]));
        const nextObjectIds = new Set(nextObjects.map((item) => item.object_id));
        const removable = existingActivityObjects.filter((item) => !nextObjectIds.has(item.objectId));
        const blocked = removable.filter((item) => item._count.results > 0);

        if (blocked.length > 0) {
          const names = blocked.map((item) => item.object?.name || 'objeto').join(', ');
          const error = new Error(`No se pueden quitar objetos con resultados guardados: ${names}.`);
          error.status = 409;
          error.code = 'ACTIVITY_OBJECT_HAS_RESULTS';
          throw error;
        }

        if (removable.length > 0) {
          await tx.activityObject.deleteMany({
            where: { id: { in: removable.map((item) => item.id) } },
          });
        }

        for (const [index, item] of nextObjects.entries()) {
          const payload = {
            activityType: item.activity_type || 'show',
            difficultyLevel: item.difficulty_level || 'photo',
            sortOrder: item.sort_order ?? index,
          };
          const existing = existingByObjectId.get(item.object_id);

          if (existing) {
            await tx.activityObject.update({
              where: { id: existing.id },
              data: payload,
            });
            continue;
          }

          await tx.activityObject.create({
            data: {
              activityId: req.params.id,
              objectId: item.object_id,
              ...payload,
            },
          });
        }
      }

      return tx.activity.update({
        where: { id: req.params.id },
        data: {
          ...(title && { title }),
          ...(instructions !== undefined && { instructions }),
          ...(specialist_id && { specialistId: specialist_id }),
        },
        include: activityInclude,
      });
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.delete('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const act = await prisma.activity.findUnique({ where: { id: req.params.id } });
    if (!act) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, act)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });

    await prisma.$transaction(async (tx) => {
      const activityObjects = await tx.activityObject.findMany({
        where: { activityId: req.params.id },
        select: { id: true },
      });

      const activityObjectIds = activityObjects.map((item) => item.id);

      if (activityObjectIds.length > 0) {
        await tx.gameResult.deleteMany({
          where: { activityObjectId: { in: activityObjectIds } },
        });
      }

      await tx.assignment.deleteMany({ where: { activityId: req.params.id } });
      await tx.activityObject.deleteMany({ where: { activityId: req.params.id } });
      await tx.activity.delete({ where: { id: req.params.id } });
    });

    res.json({ success: true, data: { id: req.params.id, deleted: true } });
  } catch (e) { next(e); }
});

module.exports = router;
