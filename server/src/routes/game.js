const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT } = require('../middleware/auth');

const LEVEL_ORDER = ['l1', 'l2', 'l3'];
const EXERCISES_BY_LEVEL = {
  l1: ['show'],
  l2: ['show', 'recognize', 'relate', 'memorize'],
  l3: ['show', 'recognize', 'relate', 'memorize'],
};
const LEVEL_TO_REPRESENTATION = {
  l1: 'model_3d',
  l2: 'photo',
  l3: 'drawing',
};

function ensureAssignmentAccess(user, assignment) {
  if (user.role === 'admin') return true;
  if (user.role === 'client') return assignment.clientId === user.client_id;
  if (user.role === 'specialist') return assignment.client?.specialistId === user.specialist_id;
  return false;
}

function getDefaultProgress(steps = []) {
  return {
    currentObjectId: steps[0]?.object_id || null,
    currentLevel: 'l1',
    currentExercise: 'show',
  };
}

function getCompletedKeys(stepProgress = []) {
  return stepProgress.map((item) => `${item.activityObject.objectId}_${item.level}_${item.exercise}`);
}

function isValidStep(level, exercise) {
  return LEVEL_ORDER.includes(level) && EXERCISES_BY_LEVEL[level].includes(exercise);
}

function getTotalSteps(activityObjects = []) {
  const stepsPerObject = LEVEL_ORDER.reduce((total, level) => total + EXERCISES_BY_LEVEL[level].length, 0);
  return activityObjects.length * stepsPerObject;
}

function buildSessionSteps(activityObjects = []) {
  return activityObjects.map((activityObject, index) => {
    const object = activityObject.object;

    const getMedia = (levelId) => {
      const representation = object.representations.find(
        (item) => item.level === LEVEL_TO_REPRESENTATION[levelId]
      );
      if (!representation) return null;
      return representation.mediaType === 'model_3d_url'
        ? { type: '3d', url: representation.model3dUrl }
        : { type: 'img', url: representation.fileUrl };
    };

    return {
      index,
      object_id: object.id,
      object_name: object.name,
      object_emoji: object.em,
      media: {
        l1: getMedia('l1'),
        l2: getMedia('l2'),
        l3: getMedia('l3'),
      },
    };
  });
}

router.get('/session/:assignmentId', authenticateJWT, async (req, res, next) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.assignmentId },
      include: {
        client: {
          select: { id: true, childName: true, specialistId: true },
        },
        stepProgress: {
          include: {
            activityObject: {
              select: { objectId: true },
            },
          },
        },
        activity: {
          include: {
            activityObjects: {
              include: {
                object: {
                  include: { representations: true },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }
    if (!ensureAssignmentAccess(req.user, assignment)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const steps = buildSessionSteps(assignment.activity.activityObjects);
    const defaultProgress = getDefaultProgress(steps);

    res.json({
      success: true,
      data: {
        assignment_id: assignment.id,
        client: assignment.client,
        activity: {
          title: assignment.activity.title,
          instructions: assignment.activity.instructions,
        },
        total_objects: steps.length,
        steps,
        progress: {
          current_object_id: assignment.currentObjectId || defaultProgress.currentObjectId,
          current_level: assignment.currentLevel || defaultProgress.currentLevel,
          current_exercise: assignment.currentExercise || defaultProgress.currentExercise,
          completed_keys: assignment.completedAt ? [] : getCompletedKeys(assignment.stepProgress),
          started_at: assignment.startedAt,
          progress_updated_at: assignment.progressUpdatedAt,
          completed_at: assignment.completedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/progress', authenticateJWT, async (req, res, next) => {
  try {
    const { assignment_id, current_object_id, current_level, current_exercise } = req.body;
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignment_id },
      include: {
        client: { select: { specialistId: true } },
        activity: {
          include: {
            activityObjects: { select: { objectId: true } },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }
    if (!ensureAssignmentAccess(req.user, assignment)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    if (current_object_id && !assignment.activity.activityObjects.some((item) => item.objectId === current_object_id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_OBJECT' } });
    }
    if ((current_level || current_exercise) && !isValidStep(current_level || 'l1', current_exercise || 'show')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STEP' } });
    }

    const updated = await prisma.assignment.update({
      where: { id: assignment_id },
      data: {
        currentObjectId: current_object_id || null,
        currentLevel: current_level || null,
        currentExercise: current_exercise || null,
        startedAt: assignment.startedAt || new Date(),
        progressUpdatedAt: new Date(),
        ...(assignment.completedAt ? { completedAt: null } : {}),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/result', authenticateJWT, async (req, res, next) => {
  try {
    const { assignment_id, object_id, level, exercise, is_correct, time_ms } = req.body;
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignment_id },
      include: {
        client: { select: { specialistId: true } },
        activity: {
          include: {
            activityObjects: { select: { id: true, objectId: true } },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }
    if (!ensureAssignmentAccess(req.user, assignment)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    if (!isValidStep(level, exercise)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STEP' } });
    }

    const activityObject = assignment.activity.activityObjects.find((item) => item.objectId === object_id);
    if (!activityObject) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }

    const attemptNumber = await prisma.gameResult.count({
      where: {
        assignmentId: assignment_id,
        activityObjectId: activityObject.id,
      },
    });

    const operations = [
      prisma.gameResult.create({
        data: {
          assignmentId: assignment_id,
          activityObjectId: activityObject.id,
          isCorrect: Boolean(is_correct),
          timeMs: Number.isFinite(time_ms) ? time_ms : null,
          attemptNumber: attemptNumber + 1,
        },
      }),
    ];

    if (is_correct) {
      operations.push(
        prisma.assignmentStepProgress.upsert({
          where: {
            assignmentId_activityObjectId_level_exercise: {
              assignmentId: assignment_id,
              activityObjectId: activityObject.id,
              level,
              exercise,
            },
          },
          create: {
            assignmentId: assignment_id,
            activityObjectId: activityObject.id,
            level,
            exercise,
            timeMs: Number.isFinite(time_ms) ? time_ms : null,
            completedAt: new Date(),
          },
          update: {
            timeMs: Number.isFinite(time_ms) ? time_ms : null,
            completedAt: new Date(),
          },
        })
      );
    }

    const [result] = await prisma.$transaction(operations);

    if (is_correct) {
      const completedCount = await prisma.assignmentStepProgress.count({
        where: { assignmentId: assignment_id },
      });
      const totalSteps = getTotalSteps(assignment.activity.activityObjects);

      await prisma.assignment.update({
        where: { id: assignment_id },
        data: {
          startedAt: assignment.startedAt || new Date(),
          progressUpdatedAt: new Date(),
          completedAt: completedCount >= totalSteps ? new Date() : assignment.completedAt,
        },
      });
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.patch('/step-progress/:id/comment', authenticateJWT, async (req, res, next) => {
  try {
    const { comment } = req.body;
    const record = await prisma.assignmentStepProgress.findUnique({
      where: { id: req.params.id },
      include: {
        assignment: {
          include: {
            client: { select: { specialistId: true } },
          },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }
    if (!(req.user.role === 'admin' || (req.user.role === 'specialist' && record.assignment.client.specialistId === req.user.specialist_id))) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const updated = await prisma.assignmentStepProgress.update({
      where: { id: req.params.id },
      data: { comment: comment || null },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
