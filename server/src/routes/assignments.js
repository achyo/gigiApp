const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, scopeFilter, paginateQuery, paginatedResponse, canModify } = require('../middleware/auth');

const LEVEL_ORDER = ['l1', 'l2', 'l3'];
const EXERCISES_BY_LEVEL = {
  l1: ['show'],
  l2: ['show', 'recognize', 'relate', 'memorize'],
  l3: ['show', 'recognize', 'relate', 'memorize'],
};
const LEVEL_LABELS = {
  l1: 'Nivel 1',
  l2: 'Nivel 2',
  l3: 'Nivel 3',
};
const EXERCISE_LABELS = {
  show: 'Mostrar',
  recognize: 'Reconocer',
  relate: 'Relacionar',
  memorize: 'Memorizar',
};

function ensureAssignmentAccess(user, assignment) {
  if (user.role === 'admin') return true;
  if (user.role === 'client') return assignment.clientId === user.client_id;
  if (user.role === 'specialist') return assignment.client?.specialistId === user.specialist_id;
  return false;
}

function getTotalAssignmentSteps(activity) {
  const objectCount = activity?.activityObjects?.length || 0;
  const exercisesPerObject = LEVEL_ORDER.reduce((total, level) => total + EXERCISES_BY_LEVEL[level].length, 0);
  return objectCount * exercisesPerObject;
}

function buildProgressSummary(assignment) {
  const totalSteps = getTotalAssignmentSteps(assignment.activity);
  const completedSteps = assignment.completedAt ? totalSteps : (assignment.stepProgress?.length || 0);
  const currentObject = assignment.activity?.activityObjects?.find((item) => item.objectId === assignment.currentObjectId)?.object || null;
  const currentLevelLabel = assignment.currentLevel ? LEVEL_LABELS[assignment.currentLevel] || assignment.currentLevel : null;
  const currentExerciseLabel = assignment.currentExercise ? EXERCISE_LABELS[assignment.currentExercise] || assignment.currentExercise : null;
  const phaseLabel = assignment.completedAt
    ? 'Completada'
    : currentObject && currentLevelLabel && currentExerciseLabel
      ? `${currentObject.name} · ${currentLevelLabel} · ${currentExerciseLabel}`
      : assignment.startedAt
        ? 'En curso'
        : 'Pendiente';

  return {
    currentObjectId: assignment.currentObjectId,
    currentObjectName: currentObject?.name || null,
    currentObjectEmoji: currentObject?.em || null,
    currentLevel: assignment.currentLevel,
    currentLevelLabel,
    currentExercise: assignment.currentExercise,
    currentExerciseLabel,
    startedAt: assignment.startedAt,
    progressUpdatedAt: assignment.progressUpdatedAt,
    completedAt: assignment.completedAt,
    completedSteps,
    totalSteps,
    percent: totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0,
    phaseLabel,
  };
}

function serializeProgressRow(row) {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    activityObjectId: row.activityObjectId,
    objectId: row.activityObject.objectId,
    objectName: row.activityObject.object?.name || 'Objeto',
    objectEmoji: row.activityObject.object?.em || '📦',
    level: row.level,
    levelLabel: LEVEL_LABELS[row.level] || row.level,
    exercise: row.exercise,
    exerciseLabel: EXERCISE_LABELS[row.exercise] || row.exercise,
    timeMs: row.timeMs,
    comment: row.comment,
    completedAt: row.completedAt,
  };
}

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
        stepProgress: {
          include: {
            activityObject: {
              include: {
                object: { select: { id: true, name: true, em: true } },
              },
            },
          },
        },
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
    res.json({
      success: true,
      data: assignments.map((assignment) => ({
        ...assignment,
        progressSummary: buildProgressSummary(assignment),
      })),
    });
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
          stepProgress: {
            include: {
              activityObject: {
                include: {
                  object: { select: { id: true, name: true, em: true } },
                },
              },
            },
          },
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
    res.json(paginatedResponse(data.map((assignment) => ({
      ...assignment,
      progressSummary: buildProgressSummary(assignment),
    })), total, page, limit));
  } catch (e) { next(e); }
});

// GET /api/assignments/:id/progress
router.get('/:id/progress', authenticateJWT, async (req, res, next) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            childName: true,
            specialistId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        activity: {
          include: {
            activityObjects: {
              include: {
                object: { select: { id: true, name: true, em: true } },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        stepProgress: {
          include: {
            activityObject: {
              include: {
                object: { select: { id: true, name: true, em: true } },
              },
            },
          },
          orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!assignment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!ensureAssignmentAccess(req.user, assignment)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    res.json({
      success: true,
      data: {
        assignment: {
          ...assignment,
          progressSummary: buildProgressSummary(assignment),
        },
        history: assignment.stepProgress.map(serializeProgressRow),
      },
    });
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
