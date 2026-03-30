// src/routes/clients.js
const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, scopeFilter, paginateQuery, paginatedResponse } = require('../middleware/auth');

router.get('/', authenticateJWT, scopeFilter('clients'), async (req, res, next) => {
  try {
    const { page, limit, skip, take } = paginateQuery(req.query);
    const search = req.query.search;
    const where = { ...req.scope, ...(search && { OR: [{ childName: { contains: search, mode: 'insensitive' } }, { user: { name: { contains: search, mode: 'insensitive' } } }] }) };
    const [data, total] = await Promise.all([
      prisma.client.findMany({ where, skip, take, include: { user: { select: { id:1,name:1,email:1 } }, specialist: true }, orderBy: { createdAt: 'desc' } }),
      prisma.client.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e) { next(e); }
});

router.post('/', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { child_name, child_birth_date, diagnosis_notes, specialist_id, email, name, password } = req.body;
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(password || 'Client1234!', 12);
    const specId = specialist_id || req.user.specialist_id;
    const client = await prisma.client.create({
      data: {
        childName: child_name, childBirthDate: child_birth_date ? new Date(child_birth_date) : null,
        diagnosisNotes: diagnosis_notes, specialistId: specId,
        user: { create: { name: name || child_name, email, passwordHash: hash, role: 'client',
          preferences: { create: { ttsEnabled: true, textSize: 1 } },
        }},
      },
      include: { user: { select: { id:1,name:1,email:1 } } },
    });
    res.status(201).json({ success: true, data: client });
  } catch (e) { next(e); }
});

router.patch('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const { child_name, diagnosis_notes } = req.body;
    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: { ...(child_name && { childName: child_name }), ...(diagnosis_notes !== undefined && { diagnosisNotes: diagnosis_notes }) },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.delete('/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    await prisma.client.update({ where: { id: req.params.id }, data: {} }); // soft via user.active
    res.status(204).send();
  } catch (e) { next(e); }
});

module.exports = router;
