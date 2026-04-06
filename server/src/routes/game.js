// src/routes/game.js
const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT } = require('../middleware/auth');

// GET /api/game/session/:assignmentId
router.get('/session/:assignmentId', authenticateJWT, async (req, res, next) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.assignmentId },
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
    });
    if (!assignment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });

    const steps = assignment.activity.activityObjects.map((ao, idx) => {
      const obj = ao.object;
      const getMedia = (level) => {
        const rep = obj.representations.find(r => r.level === level);
        if (!rep) return null;
        return rep.mediaType === 'model_3d_url'
          ? { type: '3d', url: rep.model3dUrl }
          : { type: 'img', url: rep.fileUrl };
      };
      return {
        index: idx,
        object_id: obj.id,
        object_name: obj.name,
        object_emoji: obj.em,
        media: {
          l1: getMedia('model_3d'),
          l2: getMedia('photo'),
          l3: getMedia('drawing'),
        },
      };
    });

    res.json({
      success: true,
      data: {
        assignment_id: assignment.id,
        activity: { title: assignment.activity.title, instructions: assignment.activity.instructions },
        total_objects: steps.length,
        steps,
      },
    });
  } catch(e){ next(e); }
});

// POST /api/game/result — record attempt
router.post('/result', authenticateJWT, async (req, res, next) => {
  try {
    const { assignment_id, object_id, level, exercise, is_correct, time_ms } = req.body;
    // Find the activityObject
    const assignment = await prisma.assignment.findUnique({ where: { id: assignment_id }, select: { activityId: true } });
    if (!assignment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    const ao = await prisma.activityObject.findFirst({
      where: { activityId: assignment.activityId, objectId: object_id },
    });
    if (!ao) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });

    const result = await prisma.gameResult.create({
      data: { assignmentId: assignment_id, activityObjectId: ao.id, isCorrect: is_correct, timeMs: time_ms },
    });
    res.status(201).json({ success: true, data: result });
  } catch(e){ next(e); }
});

module.exports = router;
