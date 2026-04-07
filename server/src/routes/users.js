// src/routes/users.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { assertStrongPassword } = require('../lib/password');
const { authenticateJWT, authorizeRole, paginateQuery, paginatedResponse } = require('../middleware/auth');
const { recordAdminAudit } = require('../lib/adminAudit');

router.get('/', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { page, limit, skip, take } = paginateQuery(req.query);
    const { search, role } = req.query;
    const where = {
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }),
      ...(role && { role }),
    };
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take, select: { id:1,name:1,email:1,role:1,active:1,createdAt:1 }, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e) { next(e); }
});

router.post('/', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    assertStrongPassword(password);
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash: hash, role,
        ...(role === 'specialist' && { specialistProfile: { create: {} } }),
      },
      select: { id:1,name:1,email:1,role:1 },
    });
    await recordAdminAudit({
      user: req.user,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      message: `Cuenta ${role} creada: ${email}.`,
      diff: { name, email, role },
    });
    res.status(201).json({ success: true, data: user });
  } catch (e) { next(e); }
});

router.patch('/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { name, email, bio, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { specialistProfile: true },
    });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });

    let passwordHash;
    if (password) {
      assertStrongPassword(password, { required: false });
      passwordHash = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(passwordHash && { passwordHash }),
        ...(bio !== undefined && user.specialistProfile && {
          specialistProfile: { update: { bio } },
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        specialistProfile: { select: { id: true, bio: true } },
      },
    });
    await recordAdminAudit({
      user: req.user,
      action: 'user.update',
      entityType: 'user',
      entityId: updated.id,
      message: `Cuenta ${updated.email} actualizada.`,
      diff: { name, email, bio: user.specialistProfile ? bio : undefined, passwordChanged: Boolean(passwordHash) },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.get('/:id/preferences', authenticateJWT, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.sub !== req.params.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const prefs = await prisma.userPreference.findUnique({ where: { userId: req.params.id } });
    res.json({ success: true, data: prefs });
  } catch (e) { next(e); }
});

router.patch('/:id/preferences', authenticateJWT, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.sub !== req.params.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const { color_profile_id, tts_enabled, tts_language, tts_rate, tts_volume, text_size, sequential_mode, list_layouts } = req.body;
    const prefs = await prisma.userPreference.upsert({
      where: { userId: req.params.id },
      create: {
        userId: req.params.id,
        colorProfileId: color_profile_id,
        ttsEnabled: tts_enabled ?? true,
        ttsLanguage: tts_language || 'es-ES',
        ttsRate: tts_rate ?? 0.9,
        ttsVolume: tts_volume ?? 1,
        textSize: text_size ?? 1,
        sequentialMode: sequential_mode ?? true,
        ...(list_layouts !== undefined && { listLayouts: list_layouts }),
      },
      update: {
        ...(color_profile_id !== undefined && { colorProfileId: color_profile_id }),
        ...(tts_enabled !== undefined && { ttsEnabled: tts_enabled }),
        ...(tts_language !== undefined && { ttsLanguage: tts_language }),
        ...(tts_rate !== undefined && { ttsRate: tts_rate }),
        ...(tts_volume !== undefined && { ttsVolume: tts_volume }),
        ...(text_size !== undefined && { textSize: text_size }),
        ...(sequential_mode !== undefined && { sequentialMode: sequential_mode }),
        ...(list_layouts !== undefined && { listLayouts: list_layouts }),
      },
    });
    res.json({ success: true, data: prefs });
  } catch (e) { next(e); }
});

router.delete('/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
    await recordAdminAudit({
      user: req.user,
      action: 'user.deactivate',
      entityType: 'user',
      entityId: req.params.id,
      message: `Cuenta ${user.email} desactivada.`,
    });
    res.json({ success: true, data: { id: req.params.id, active: false } });
  } catch (e) { next(e); }
});

module.exports = router;
