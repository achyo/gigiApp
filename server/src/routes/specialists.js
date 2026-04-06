// src/routes/specialists.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { assertStrongPassword } = require('../lib/password');
const { authenticateJWT, authorizeRole } = require('../middleware/auth');
router.get('/', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const data = await prisma.specialist.findMany({ include: { user: { select:{id:1,name:1,email:1,active:1} }, _count:{select:{clients:true,activities:true}} } });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});

router.patch('/:id', authenticateJWT, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { name, email, bio, password } = req.body;
    let passwordHash;
    if (password) {
      assertStrongPassword(password, { required: false });
      passwordHash = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.specialist.update({
      where: { id: req.params.id },
      data: {
        ...(bio !== undefined && { bio }),
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
      include: { user: { select:{id:1,name:1,email:1,active:1} }, _count:{select:{clients:true,activities:true}} },
    });

    res.json({ success: true, data: updated });
  } catch(e){ next(e); }
});

router.get('/:id/clients', authenticateJWT, async (req, res, next) => {
  try {
    const data = await prisma.client.findMany({ where: { specialistId: req.params.id } });
    res.json({ success: true, data });
  } catch(e){ next(e); }
});
module.exports = router;
