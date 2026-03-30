// src/routes/users.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, paginateQuery, paginatedResponse } = require('../middleware/auth');

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
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash: hash, role,
        ...(role === 'specialist' && { specialistProfile: { create: {} } }),
      },
      select: { id:1,name:1,email:1,role:1 },
    });
    res.status(201).json({ success: true, data: user });
  } catch (e) { next(e); }
});

router.get('/:id/preferences', authenticateJWT, async (req, res, next) => {
  try {
    const prefs = await prisma.userPreference.findUnique({ where: { userId: req.params.id } });
    res.json({ success: true, data: prefs });
  } catch (e) { next(e); }
});

router.patch('/:id/preferences', authenticateJWT, async (req, res, next) => {
  try {
    const { color_profile_id, tts_enabled, text_size, sequential_mode } = req.body;
    const prefs = await prisma.userPreference.upsert({
      where: { userId: req.params.id },
      create: { userId: req.params.id, colorProfileId: color_profile_id, ttsEnabled: tts_enabled ?? true, textSize: text_size ?? 1, sequentialMode: sequential_mode ?? true },
      update: { ...(color_profile_id !== undefined && { colorProfileId: color_profile_id }), ...(tts_enabled !== undefined && { ttsEnabled: tts_enabled }), ...(text_size !== undefined && { textSize: text_size }), ...(sequential_mode !== undefined && { sequentialMode: sequential_mode }) },
    });
    res.json({ success: true, data: prefs });
  } catch (e) { next(e); }
});

router.delete('/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
    res.status(204).send();
  } catch (e) { next(e); }
});

module.exports = router;
