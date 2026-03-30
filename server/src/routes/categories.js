const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, canModify } = require('../middleware/auth');

router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = req.user.role === 'admin' ? {} : {
      OR: [{ ownerId: req.user.sub }, { ownerId: null, status: 'approved' }],
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };
    const data = await prisma.category.findMany({ where, include: { _count: { select: { objects: true } } }, orderBy: { name: 'asc' } });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});

router.post('/', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { name, description, is_public } = req.body;
    const ownerId = req.user.role === 'admin' && is_public ? null : req.user.sub;
    const status  = req.user.role === 'admin' && is_public ? 'approved' : 'private';
    const cat = await prisma.category.create({ data: { name, description, ownerId, status } });
    res.status(201).json({ success: true, data: cat });
  } catch(e){ next(e); }
});

router.patch('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const cat = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!cat) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, cat)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    const { name, description } = req.body;
    const updated = await prisma.category.update({ where: { id: req.params.id }, data: { name, description } });
    res.json({ success: true, data: updated });
  } catch(e){ next(e); }
});

router.delete('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const inUse = await prisma.object.count({ where: { categoryId: req.params.id } });
    if (inUse > 0) return res.status(409).json({ success: false, error: { code: 'CATEGORY_IN_USE' } });
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch(e){ next(e); }
});

module.exports = router;
