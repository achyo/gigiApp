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

function getExercisesPerObject() {
  return LEVEL_ORDER.reduce((total, level) => total + EXERCISES_BY_LEVEL[level].length, 0);
}

function getTotalAssignmentSteps(activityOrObjects) {
  const activityObjects = Array.isArray(activityOrObjects)
    ? activityOrObjects
    : activityOrObjects?.activityObjects || [];
  return activityObjects.length * getExercisesPerObject();
}

function getAssignmentCurrentObject(assignment) {
  return assignment.activity?.activityObjects?.find((item) => item.objectId === assignment.currentObjectId)?.object || null;
}

function buildAssignmentProgressSummary(assignment) {
  const totalSteps = getTotalAssignmentSteps(assignment.activity);
  const completedSteps = assignment.completedAt ? totalSteps : (assignment.stepProgress?.length || 0);
  const currentObject = getAssignmentCurrentObject(assignment);
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

function toTimestamp(value) {
  if (!value) return null;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : null;
}

function getAssignmentLastActivityAt(assignment) {
  const timestamps = [
    assignment.progressUpdatedAt,
    assignment.completedAt,
    assignment.startedAt,
    assignment.assignedAt,
    ...(assignment.results || []).map((result) => result.createdAt),
    ...(assignment.stepProgress || []).map((row) => row.completedAt),
  ]
    .map(toTimestamp)
    .filter((value) => value !== null);

  return timestamps.length ? new Date(Math.max(...timestamps)) : null;
}

function getStudentStatus(metrics) {
  if (!metrics.assignmentCount) {
    return { tone: 'default', label: 'Sin actividades' };
  }

  if (!metrics.lastActivityAt) {
    return { tone: 'amber', label: 'Pendiente de empezar' };
  }

  const daysSinceActivity = Math.floor((Date.now() - new Date(metrics.lastActivityAt).getTime()) / 86400000);
  const hasLowAccuracy = metrics.totalAttempts >= 8 && metrics.accuracyPercent !== null && metrics.accuracyPercent < 65;
  const hasSlowProgress = metrics.startedAssignments > 0 && metrics.completionPercent < 35 && daysSinceActivity >= 14;
  const hasStalledActivity = metrics.activeAssignments > 0 && daysSinceActivity >= 21;

  if (hasLowAccuracy || hasSlowProgress || hasStalledActivity) {
    return { tone: 'red', label: 'Necesita apoyo' };
  }

  if (metrics.activeAssignments > 0 && daysSinceActivity >= 10) {
    return { tone: 'amber', label: 'Seguimiento cercano' };
  }

  const isStrongAccuracy = metrics.accuracyPercent === null || metrics.accuracyPercent >= 82;
  const isSolidCompletion = metrics.completionPercent >= 85;
  const isRecent = daysSinceActivity <= 14;

  if (metrics.completedAssignments > 0 && isSolidCompletion && isStrongAccuracy && isRecent) {
    return { tone: 'green', label: 'Buen avance' };
  }

  return { tone: 'blue', label: 'En progreso' };
}

function buildStudentProgressSummary(client) {
  const assignments = client.assignments || [];
  const assignmentRows = assignments.map((assignment) => {
    const progressSummary = buildAssignmentProgressSummary(assignment);
    return {
      id: assignment.id,
      title: assignment.activity?.title || 'Actividad',
      assignedAt: assignment.assignedAt,
      isActive: assignment.isActive,
      lastActivityAt: getAssignmentLastActivityAt(assignment),
      progressSummary,
    };
  });
  const latestAssignment = [...assignmentRows].sort((left, right) => {
    const rightStamp = toTimestamp(right.lastActivityAt) || 0;
    const leftStamp = toTimestamp(left.lastActivityAt) || 0;
    return rightStamp - leftStamp;
  })[0] || null;

  const assignmentCount = assignments.length;
  const completedAssignments = assignments.filter((assignment) => Boolean(assignment.completedAt)).length;
  const startedAssignments = assignments.filter((assignment) => Boolean(assignment.startedAt)).length;
  const activeAssignments = assignments.filter((assignment) => assignment.isActive !== false).length;
  const totalSteps = assignmentRows.reduce((total, assignment) => total + assignment.progressSummary.totalSteps, 0);
  const completedSteps = assignmentRows.reduce((total, assignment) => total + assignment.progressSummary.completedSteps, 0);
  const allResults = assignments.flatMap((assignment) => assignment.results || []);
  const correctAnswers = allResults.filter((result) => result.isCorrect).length;
  const incorrectAnswers = allResults.length - correctAnswers;
  const timedResults = allResults.filter((result) => Number.isFinite(result.timeMs));
  const averageTimeMs = timedResults.length
    ? Math.round(timedResults.reduce((total, result) => total + result.timeMs, 0) / timedResults.length)
    : null;
  const completionPercent = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const accuracyPercent = allResults.length ? Math.round((correctAnswers / allResults.length) * 100) : null;
  const lastActivityAt = latestAssignment?.lastActivityAt || null;
  const daysSinceLastActivity = lastActivityAt ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86400000) : null;
  const status = getStudentStatus({
    assignmentCount,
    activeAssignments,
    startedAssignments,
    completedAssignments,
    completionPercent,
    accuracyPercent,
    totalAttempts: allResults.length,
    lastActivityAt,
  });

  return {
    clientId: client.id,
    childName: client.childName,
    tutorName: client.user?.name || null,
    tutorEmail: client.user?.email || null,
    specialistId: client.specialistId || null,
    specialistName: client.specialist?.user?.name || null,
    active: client.active !== false && client.user?.active !== false,
    groupNames: (client.groups || []).map((group) => group.name),
    assignmentStats: {
      total: assignmentCount,
      started: startedAssignments,
      completed: completedAssignments,
      active: activeAssignments,
      pending: Math.max(assignmentCount - startedAssignments, 0),
    },
    stepStats: {
      completed: completedSteps,
      total: totalSteps,
      percent: completionPercent,
    },
    responseStats: {
      correct: correctAnswers,
      incorrect: incorrectAnswers,
      total: allResults.length,
      accuracyPercent,
      averageTimeMs,
    },
    activity: {
      lastActivityAt,
      daysSinceLastActivity,
      latestActivityTitle: latestAssignment?.title || null,
      currentPhaseLabel: latestAssignment?.progressSummary?.phaseLabel || null,
    },
    status,
    assignments: assignmentRows,
  };
}

function getPriorityWeight(student) {
  if (student.status.tone === 'red') return 3;
  if (student.status.tone === 'amber') return 2;
  if (student.status.tone === 'blue') return 1;
  return 0;
}

function buildSpecialistProgressOverview(clients = []) {
  const students = clients
    .map(buildStudentProgressSummary)
    .sort((left, right) => {
      const priorityDiff = getPriorityWeight(right) - getPriorityWeight(left);
      if (priorityDiff !== 0) return priorityDiff;

      const recentDiff = (toTimestamp(right.activity.lastActivityAt) || 0) - (toTimestamp(left.activity.lastActivityAt) || 0);
      if (recentDiff !== 0) return recentDiff;

      return (left.childName || '').localeCompare(right.childName || '', 'es');
    });

  const studentsWithAssignments = students.filter((student) => student.assignmentStats.total > 0);
  const studentsWithAccuracy = students.filter((student) => student.responseStats.accuracyPercent !== null);
  const recentActiveStudents = students.filter((student) => {
    const lastActivityAt = toTimestamp(student.activity.lastActivityAt);
    return lastActivityAt !== null && (Date.now() - lastActivityAt) <= 7 * 86400000;
  });

  return {
    summary: {
      totalStudents: students.length,
      studentsWithAssignments: studentsWithAssignments.length,
      averageCompletionPercent: studentsWithAssignments.length
        ? Math.round(studentsWithAssignments.reduce((total, student) => total + student.stepStats.percent, 0) / studentsWithAssignments.length)
        : 0,
      averageAccuracyPercent: studentsWithAccuracy.length
        ? Math.round(studentsWithAccuracy.reduce((total, student) => total + student.responseStats.accuracyPercent, 0) / studentsWithAccuracy.length)
        : null,
      attentionCount: students.filter((student) => ['red', 'amber'].includes(student.status.tone)).length,
      recentActivityCount: recentActiveStudents.length,
    },
    students,
  };
}

function buildAdminLearningOverview(clients = []) {
  const overview = buildSpecialistProgressOverview(clients);
  const studentsWithAssignments = overview.students.filter((student) => student.assignmentStats.total > 0);
  const attentionStudents = overview.students
    .filter((student) => ['red', 'amber'].includes(student.status.tone))
    .slice(0, 6);
  const leadingStudents = [...studentsWithAssignments]
    .sort((left, right) => {
      const progressDiff = right.stepStats.percent - left.stepStats.percent;
      if (progressDiff !== 0) return progressDiff;
      const accuracyDiff = (right.responseStats.accuracyPercent ?? -1) - (left.responseStats.accuracyPercent ?? -1);
      if (accuracyDiff !== 0) return accuracyDiff;
      return (left.childName || '').localeCompare(right.childName || '', 'es');
    })
    .slice(0, 6);

  return {
    ...overview,
    attentionStudents,
    leadingStudents,
  };
}

module.exports = {
  LEVEL_ORDER,
  EXERCISES_BY_LEVEL,
  LEVEL_LABELS,
  EXERCISE_LABELS,
  getTotalAssignmentSteps,
  buildAssignmentProgressSummary,
  buildStudentProgressSummary,
  buildSpecialistProgressOverview,
  buildAdminLearningOverview,
};