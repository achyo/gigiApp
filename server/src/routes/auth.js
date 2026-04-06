const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../lib/prisma');
const { redis } = require('../lib/redis');
const { assertStrongPassword } = require('../lib/password');
const { authenticateJWT } = require('../middleware/auth');

const ACCESS_TTL  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function signAccess(user) {
  const payload = {
    sub: user.id, role: user.role,
    ...(user.specialistProfile && { specialist_id: user.specialistProfile.id }),
    ...(user.clientProfile     && { client_id:     user.clientProfile.id }),
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(userId) {
  return jwt.sign({ sub: userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: REFRESH_TTL });
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS' } });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { specialistProfile: true, clientProfile: true },
    });
    if (!user || !user.active) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS' } });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS' } });

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user.id);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.refreshToken.create({
      data: {
        userId: user.id, tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    // Load preferences
    const prefs = await prisma.userPreference.findUnique({ where: { userId: user.id } });

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
          specialist_id: user.specialistProfile?.id ?? null,
          client_id: user.clientProfile?.id ?? null,
        },
        preferences: prefs,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN' } });

    const payload = jwt.verify(refresh_token, process.env.JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error();

    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, error: { code: 'TOKEN_INVALID' } });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { specialistProfile: true, clientProfile: true },
    });
    if (!user || !user.active) {
      return res.status(401).json({ success: false, error: { code: 'TOKEN_INVALID' } });
    }
    res.json({ success: true, data: { access_token: signAccess(user) } });
  } catch (e) {
    res.status(401).json({ success: false, error: { code: 'TOKEN_INVALID' } });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateJWT, async (req, res, next) => {
  try {
    const token = req.headers.authorization.slice(7);
    await redis.setEx(`blacklist:${token}`, 60 * 15, '1');

    const { refresh_token } = req.body;
    if (refresh_token) {
      const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hash }, data: { revokedAt: new Date() },
      });
    }
    res.json({ success: true, data: { logged_out: true } });
  } catch (e) { next(e); }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateJWT, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    const valid = await bcrypt.compare(current_password, user.passwordHash);
    if (!valid) return res.status(400).json({ success: false, error: { code: 'WRONG_PASSWORD' } });

    assertStrongPassword(new_password);
    const hash = await bcrypt.hash(new_password, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    res.json({ success: true, data: { password_changed: true } });
  } catch (e) { next(e); }
});

module.exports = router;
