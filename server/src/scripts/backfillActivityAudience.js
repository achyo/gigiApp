const { prisma } = require('../lib/prisma');

function sortIds(ids) {
  return [...new Set(ids)].sort();
}

function sameIds(left, right) {
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

function findExactGroupCombination(groups, targetIds) {
  const wanted = new Set(targetIds);
  const candidates = groups
    .map((group) => ({
      id: group.id,
      clientIds: sortIds((group.clients || []).map((client) => client.id).filter((id) => wanted.has(id))),
    }))
    .filter((group) => group.clientIds.length > 0)
    .filter((group) => group.clientIds.every((id) => wanted.has(id)));

  const covered = new Set();
  const chosen = [];

  function search(startIndex) {
    if (covered.size === wanted.size) return true;
    for (let index = startIndex; index < candidates.length; index += 1) {
      const group = candidates[index];
      const addsNewClient = group.clientIds.some((id) => !covered.has(id));
      if (!addsNewClient) continue;

      chosen.push(group.id);
      const added = [];
      group.clientIds.forEach((id) => {
        if (!covered.has(id)) {
          covered.add(id);
          added.push(id);
        }
      });

      if (search(index + 1)) return true;

      chosen.pop();
      added.forEach((id) => covered.delete(id));
    }
    return false;
  }

  if (!search(0)) return [];
  return chosen;
}

function inferAudience(activity) {
  const assignmentClientIds = sortIds((activity.assignments || []).map((assignment) => assignment.clientId));
  const specialistClientIds = sortIds((activity.specialist?.clients || []).map((client) => client.id));

  if (assignmentClientIds.length === 0) {
    return null;
  }

  if (specialistClientIds.length > 0 && sameIds(assignmentClientIds, specialistClientIds)) {
    return {
      mode: 'all',
      specialistId: activity.specialistId,
      clientIds: [],
      groupIds: [],
    };
  }

  const exactSingleGroup = (activity.specialist?.groups || []).find((group) => {
    const groupClientIds = sortIds((group.clients || []).map((client) => client.id));
    return groupClientIds.length > 0 && sameIds(groupClientIds, assignmentClientIds);
  });

  if (exactSingleGroup) {
    return {
      mode: 'groups',
      specialistId: activity.specialistId,
      clientIds: assignmentClientIds,
      groupIds: [exactSingleGroup.id],
    };
  }

  const groupIds = findExactGroupCombination(activity.specialist?.groups || [], assignmentClientIds);
  if (groupIds.length > 0) {
    return {
      mode: 'groups',
      specialistId: activity.specialistId,
      clientIds: assignmentClientIds,
      groupIds,
    };
  }

  return {
    mode: 'clients',
    specialistId: activity.specialistId,
    clientIds: assignmentClientIds,
    groupIds: [],
  };
}

async function main() {
  const activities = await prisma.activity.findMany({
    include: {
      assignments: {
        where: { isActive: true },
        select: { clientId: true },
      },
      specialist: {
        include: {
          clients: { select: { id: true } },
          groups: { include: { clients: { select: { id: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const legacyActivities = activities.filter((activity) => activity.audience == null);

  let updated = 0;
  let skipped = 0;

  for (const activity of legacyActivities) {
    const audience = inferAudience(activity);
    if (!audience) {
      skipped += 1;
      continue;
    }

    await prisma.activity.update({
      where: { id: activity.id },
      data: { audience },
    });
    updated += 1;
  }

  console.log(JSON.stringify({ scanned: legacyActivities.length, updated, skipped }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });