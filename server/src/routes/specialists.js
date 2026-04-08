// src/routes/specialists.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { assertStrongPassword } = require('../lib/password');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');
const { buildSpecialistProgressOverview } = require('../lib/progressMetrics');
const { recordAdminAudit } = require('../lib/adminAudit');

router.get('/', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const data = await prisma.specialist.findMany({ include: { user: { select:{id:1,name:1,email:1,active:1} }, _count:{select:{clients:true,activities:true}} } });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});

router.get('/me/student-progress', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const targetSpecialistId = req.user.role === 'specialist' ? req.user.specialist_id : req.query.specialist_id;
    if (!targetSpecialistId) {
      return res.status(400).json({ success: false, error: { code: 'SPECIALIST_REQUIRED', message: 'Debes indicar un especialista.' } });
    }

    const specialist = await prisma.specialist.findUnique({
      where: { id: targetSpecialistId },
      include: { user: { select: { id: true, name: true, email: true, active: true } } },
    });

    if (!specialist) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }

    const clients = await prisma.client.findMany({
      where: { specialistId: targetSpecialistId },
      include: {
        user: { select: { id: true, name: true, email: true, active: true } },
        groups: { select: { id: true, name: true, color: true } },
        assignments: {
          include: {
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
              select: { id: true, completedAt: true, timeMs: true },
            },
            results: {
              select: { isCorrect: true, timeMs: true, createdAt: true },
            },
          },
          orderBy: [{ progressUpdatedAt: 'desc' }, { assignedAt: 'desc' }],
        },
      },
      orderBy: { childName: 'asc' },
    });

    res.json({
      success: true,
      data: {
        specialist: {
          id: specialist.id,
          userId: specialist.userId,
          name: specialist.user?.name || 'Especialista',
          email: specialist.user?.email || null,
          active: specialist.user?.active !== false,
        },
        ...buildSpecialistProgressOverview(clients),
      },
    });
  } catch (e) { next(e); }
});

router.patch('/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { name, email, bio, password } = req.body;
    let passwordHash;
    if (password) {
      assertStrongPassword(password, { required: false });
      passwordHash = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.specialist.update({
      where: { id: req.params.id },
      data: {
        ...(bio !== undefined && { bio }),
        ...((name !== undefined || email !== undefined || passwordHash) && {
          user: {
            update: {
              ...(name !== undefined && { name }),
              ...(email !== undefined && { email }),
              ...(passwordHash && { passwordHash }),
            },
          },
        }),
      },
      include: { user: { select:{id:1,name:1,email:1,active:1} }, _count:{select:{clients:true,activities:true}} },
    });

    await recordAdminAudit({
      user: req.user,
      action: 'specialist.update',
      entityType: 'specialist',
      entityId: updated.id,
      message: `Especialista ${updated.user?.email || updated.id} actualizado.`,
      diff: { name, email, bio, passwordChanged: Boolean(passwordHash) },
    });

    res.json({ success: true, data: updated });
  } catch(e){ next(e); }
});

router.get('/:id/clients', authenticateJWT, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && !(req.user.role === 'specialist' && req.user.specialist_id === req.params.id)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const data = await prisma.client.findMany({ where: { specialistId: req.params.id } });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});
module.exports = router;
