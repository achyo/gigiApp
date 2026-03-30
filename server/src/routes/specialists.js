// src/routes/specialists.js
const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');
router.get('/', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const data = await prisma.specialist.findMany({ include: { user: { select:{id:1,name:1,email:1,active:1} }, _count:{select:{clients:true,activities:true}} } });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});
router.get('/:id/clients', authenticateJWT, async (req, res, next) => {
  try {
    const data = await prisma.client.findMany({ where: { specialistId: req.params.id } });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});
module.exports = router;
