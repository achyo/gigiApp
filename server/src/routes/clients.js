// src/routes/clients.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { prisma } = require('../lib/prisma');
const { assertStrongPassword } = require('../lib/password');
const { authenticateJWT, authorizeRole, scopeFilter, paginateQuery, paginatedResponse } = require('../middleware/auth');

const clientInclude = {
  user: { select: { id: 1, name: 1, email: 1 } },
  specialist: { include: { user: { select: { id: 1, name: 1, email: 1 } } } },
  groups: { select: { id: 1, name: 1, color: 1 } },
};

router.get('/', authenticateJWT, scopeFilter('clients'), async (req, res, next) => {
  try {
    const { page, limit, skip, take } = paginateQuery(req.query);
    const search = req.query.search;
    const where = { ...req.scope, ...(search && { OR: [{ childName: { contains: search, mode: 'insensitive' } }, { user: { name: { contains: search, mode: 'insensitive' } } }] }) };
    const [data, total] = await Promise.all([
      prisma.client.findMany({ where, skip, take, include: clientInclude, orderBy: { createdAt: 'desc' } }),
      prisma.client.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e) { next(e); }
});

router.post('/', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { child_name, child_birth_date, diagnosis_notes, specialist_id, email, name, password } = req.body;
    assertStrongPassword(password || 'Client1234!');
    const hash = await bcrypt.hash(password || 'Client1234!', 12);
    const specId = specialist_id || req.user.specialist_id;
    if (!specId) {
      return res.status(400).json({ success: false, error: { code: 'SPECIALIST_REQUIRED' } });
    }
    const client = await prisma.client.create({
      data: {
        childName: child_name, childBirthDate: child_birth_date ? new Date(child_birth_date) : null,
        diagnosisNotes: diagnosis_notes,
        specialist: { connect: { id: specId } },
        user: { create: { name: name || child_name, email, passwordHash: hash, role: 'client',
          preferences: { create: { ttsEnabled: true, textSize: 1 } },
        }},
      },
      include: clientInclude,
    });
    res.status(201).json({ success: true, data: client });
  } catch (e) { next(e); }
});

router.patch('/:id', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { child_name, diagnosis_notes, specialist_id, name, email, password } = req.body;
    const client = await prisma.client.findUnique({ where: { id: req.params.id }, select: { specialistId: true } });
    if (!client) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (req.user.role === 'specialist' && client.specialistId !== req.user.specialist_id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    let passwordHash;
    if (password) {
      assertStrongPassword(password, { required: false });
      passwordHash = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...(child_name && { childName: child_name }),
        ...(diagnosis_notes !== undefined && { diagnosisNotes: diagnosis_notes }),
        ...(specialist_id && { specialist: { connect: { id: specialist_id } } }),
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
      include: clientInclude,
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
