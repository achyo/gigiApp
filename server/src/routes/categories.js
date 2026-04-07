const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole, canModify } = require('../middleware/auth');

router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = {
      ...(req.user.role === 'admin' ? {} : { OR: [{ ownerId: req.user.sub }, { ownerId: null, status: 'approved' }] }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };
    const data = await prisma.category.findMany({
      where,
      include: { _count: { select: { objects: true } } },
      orderBy: [{ ownerId: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});

router.post('/', authenticateJWT, authorizeRole('admin','specialist'), async (req, res, next) => {
  try {
    const { name, description, color, is_public } = req.body;
    const wantsPublic = req.user.role === 'admin' ? true : Boolean(is_public);
    const ownerId = wantsPublic && req.user.role === 'admin' ? null : req.user.sub;
    const status = wantsPublic ? (req.user.role === 'admin' ? 'approved' : 'pending') : 'private';
    const cat = await prisma.category.create({
      data: { name, description, color: color || '#1A5FD4', ownerId, status },
    });
    res.status(201).json({ success: true, data: cat });
  } catch(e){ next(e); }
});

router.patch('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const cat = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!cat) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, cat)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    const { name, description, color, is_public } = req.body;
    const wantsPublic = req.user.role === 'admin' ? true : Boolean(is_public);
    const nextStatus = wantsPublic ? (req.user.role === 'admin' ? 'approved' : 'pending') : 'private';
    const nextOwnerId = wantsPublic && req.user.role === 'admin' ? null : req.user.sub;
    const updated = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        status: nextStatus,
        ownerId: nextOwnerId,
        ...(nextStatus !== 'rejected' && { rejectedNote: null }),
      },
    });
    res.json({ success: true, data: updated });
  } catch(e){ next(e); }
});

router.delete('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, category)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    const inUse = await prisma.object.count({ where: { categoryId: req.params.id } });
    if (inUse > 0) return res.status(409).json({ success: false, error: { code: 'CATEGORY_IN_USE' } });
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id, deleted: true } });
  } catch(e){ next(e); }
});

module.exports = router;
