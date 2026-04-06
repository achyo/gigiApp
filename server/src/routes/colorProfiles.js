const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');

router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    const data = await prisma.colorProfile.findMany({ orderBy: [{ isDefault:'desc'},{name:'asc'}] });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});

router.post('/', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { name, bg_color, text_color, accent_color, is_default } = req.body;
    if (is_default) await prisma.colorProfile.updateMany({ data: { isDefault: false } });
    const p = await prisma.colorProfile.create({ data: { name, bgColor:bg_color, textColor:text_color, accentColor:accent_color, isDefault:!!is_default } });
    res.status(201).json({ success: true, data: p });
  } catch(e){ next(e); }
});

router.patch('/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { name, bg_color, text_color, accent_color } = req.body;
    const p = await prisma.colorProfile.update({ where:{ id:req.params.id }, data:{ name, bgColor:bg_color, textColor:text_color, accentColor:accent_color } });
    res.json({ success: true, data: p });
  } catch(e){ next(e); }
});

router.patch('/:id/set-default', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    await prisma.colorProfile.updateMany({ data: { isDefault: false } });
    const p = await prisma.colorProfile.update({ where:{ id:req.params.id }, data:{ isDefault:true } });
    res.json({ success: true, data: p });
  } catch(e){ next(e); }
});

router.delete('/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const profile = await prisma.colorProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    await prisma.colorProfile.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id, deleted: true } });
  } catch(e){ next(e); }
});

module.exports = router;
