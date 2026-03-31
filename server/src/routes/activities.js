// src/routes/activities.js
const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, scopeFilter, canModify, paginateQuery, paginatedResponse } = require('../middleware/auth');

router.get('/', authenticateJWT, scopeFilter('activities'), async (req, res, next) => {
  try {
    const { page, limit, skip, take } = paginateQuery(req.query);
    const search = req.query.search;
    const where = { ...req.scope, ...(search && { title: { contains: search, mode: 'insensitive' } }) };
    const [data, total] = await Promise.all([
      prisma.activity.findMany({
        where, skip, take,
        include: { activityObjects: { include: { object: { include: { representations: true } } } } },
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
      include: { activityObjects: { include: { object: { include: { representations: true } } }, orderBy: { sortOrder: 'asc' } } },
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
      include: {
        specialist: { include: { user: { select: { id:1,name:1,email:1 } } } },
        activityObjects: { include: { object: true }, orderBy: { sortOrder: 'asc' } },
      },
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
        await tx.activityObject.deleteMany({ where: { activityId: req.params.id } });
      }

      return tx.activity.update({
        where: { id: req.params.id },
        data: {
          ...(title && { title }),
          ...(instructions !== undefined && { instructions }),
          ...(specialist_id && { specialistId: specialist_id }),
          ...(Array.isArray(objects) && {
            activityObjects: {
              create: objects.map((o, i) => ({
                objectId: o.object_id,
                activityType: o.activity_type || 'show',
                difficultyLevel: o.difficulty_level || 'photo',
                sortOrder: o.sort_order ?? i,
              })),
            },
          }),
        },
        include: {
          specialist: { include: { user: { select: { id:1,name:1,email:1 } } } },
          activityObjects: { include: { object: true }, orderBy: { sortOrder: 'asc' } },
        },
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
    await prisma.activity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

module.exports = router;
