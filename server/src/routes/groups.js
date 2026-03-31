// src/routes/groups.js
const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');

router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    const specId = req.user.specialist_id;
    const where = req.user.role === 'admin' ? {} : { specId };
    const data = await prisma.group.findMany({ where, include: { clients: { select: { id:1,childName:1 } } } });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});

router.post('/', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { name, color, client_ids, specialist_id } = req.body;
    const specId = req.user.role === 'admin' ? specialist_id : req.user.specialist_id;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'El nombre del grupo es obligatorio.' } });
    }
    if (!specId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Debes seleccionar un especialista para el grupo.' } });
    }
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        color,
        specialist: { connect: { id: specId } },
        clients: { connect: (client_ids||[]).map(id=>({id})) },
      },
      include: { clients: { select:{id:1,childName:1} } },
    });
    res.status(201).json({ success: true, data: group });
  } catch(e){ next(e); }
});

router.patch('/:id', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { name, color, client_ids, specialist_id } = req.body;
    const specId = req.user.role === 'admin' ? specialist_id : req.user.specialist_id;
    const group = await prisma.group.update({
      where: { id: req.params.id },
      data: { ...(name&&{name: name.trim()}), ...(color&&{color}),
        ...(specId && { specialist: { connect: { id: specId } } }),
        ...(client_ids && { clients: { set: client_ids.map(id=>({id})) } }),
      },
      include: { clients: { select:{id:1,childName:1} } },
    });
    res.json({ success: true, data: group });
  } catch(e){ next(e); }
});

router.delete('/:id', authenticateJWT, async (req, res, next) => {
  try {
    await prisma.group.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch(e){ next(e); }
});

module.exports = router;
