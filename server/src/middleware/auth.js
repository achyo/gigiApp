const jwt = require('jsonwebtoken');
const { redis } = require('../lib/redis');

// ── authenticateJWT ───────────────────────────────────────────────────────────
async function authenticateJWT(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'NO_TOKEN' } });
  }
  const token = header.slice(7);
  try {
    const revoked = await redis.get(`blacklist:${token}`);
    if (revoked) return res.status(401).json({ success: false, error: { code: 'TOKEN_REVOKED' } });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return res.status(401).json({ success: false, error: { code } });
  }
}

// ── authorizeRole ─────────────────────────────────────────────────────────────
function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    next();
  };
}

// ── scopeFilter ───────────────────────────────────────────────────────────────
function scopeFilter(resource) {
  return (req, res, next) => {
    const { role, sub: userId, specialist_id, client_id } = req.user;
    switch (resource) {
      case 'users':
        req.scope = role === 'admin' ? {} : { id: userId }; break;
      case 'specialists':
        req.scope = role === 'admin' ? {} : { userId }; break;
      case 'clients':
        if (role === 'admin')       req.scope = {};
        else if (role === 'specialist') req.scope = { specialistId: specialist_id };
        else                        req.scope = { userId };
        break;
      case 'categories':
      case 'objects':
        req.scope = role === 'admin' ? {} : {
          OR: [{ ownerId: userId }, { ownerId: null, status: 'approved' }],
        };
        break;
      case 'activities':
        if (role === 'admin')       req.scope = {};
        else if (role === 'specialist') req.scope = { specialistId: specialist_id };
        else req.scope = { assignments: { some: { clientId: client_id, isActive: true } } };
        break;
      case 'assignments':
        if (role === 'admin')       req.scope = {};
        else if (role === 'specialist') req.scope = { client: { specialistId: specialist_id } };
        else                        req.scope = { clientId: client_id, isActive: true };
        break;
      default:
        req.scope = {};
    }
    next();
  };
}

// ── canModify ─────────────────────────────────────────────────────────────────
function canModify(user, resource) {
  if (user.role === 'admin') return true;
  if (resource.ownerId && resource.ownerId === user.sub) return true;
  if (resource.specialistId && resource.specialistId === user.specialist_id) return true;
  return false;
}

// ── paginateQuery ─────────────────────────────────────────────────────────────
function paginateQuery(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

function paginatedResponse(data, total, page, limit) {
  return {
    success: true,
    data,
    pagination: {
      total, page, limit,
      total_pages: Math.ceil(total / limit),
      has_next: page * limit < total,
      has_prev: page > 1,
    },
  };
}

module.exports = {
  authenticateJWT, authorizeRole, scopeFilter,
  canModify, paginateQuery, paginatedResponse,
};
