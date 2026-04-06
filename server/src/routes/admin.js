const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');

router.get('/stats', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const [users, specialists, clients, objects, categories, activities, assignments] = await Promise.all([
      prisma.user.count(),
      prisma.specialist.count(),
      prisma.client.count(),
      prisma.object.count(),
      prisma.category.count(),
      prisma.activity.count(),
      prisma.assignment.count({ where: { isActive: true } }),
    ]);
    res.json({ success: true, data: { users, specialists, clients, objects, categories, activities, assignments } });
  } catch(e){ next(e); }
});

router.get('/pending-approvals', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const [objects, categories] = await Promise.all([
      prisma.object.findMany({ where: { status: 'pending' }, include: { owner: { select:{name:1} } } }),
      prisma.category.findMany({ where: { status: 'pending' }, include: { owner: { select:{name:1} } } }),
    ]);
    res.json({ success: true, data: { objects, categories } });
  } catch(e){ next(e); }
});

router.patch('/approve/:type/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    if (!['object', 'category'].includes(req.params.type)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE' } });
    }
    const model = req.params.type === 'object' ? prisma.object : prisma.category;
    const updated = await model.update({ where: { id: req.params.id }, data: { status: 'approved', ownerId: null } });
    res.json({ success: true, data: updated });
  } catch(e){ next(e); }
});

router.patch('/reject/:type/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    if (!['object', 'category'].includes(req.params.type)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE' } });
    }
    const model = req.params.type === 'object' ? prisma.object : prisma.category;
    const updated = await model.update({ where: { id: req.params.id }, data: { status: 'rejected', rejectedNote: req.body.note } });
    res.json({ success: true, data: updated });
  } catch(e){ next(e); }
});

module.exports = router;
