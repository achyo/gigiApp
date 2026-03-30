require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true }));
app.use('/api', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/specialists',   require('./routes/specialists'));
app.use('/api/clients',       require('./routes/clients'));
app.use('/api/categories',    require('./routes/categories'));
app.use('/api/objects',       require('./routes/objects'));
app.use('/api/activities',    require('./routes/activities'));
app.use('/api/assignments',   require('./routes/assignments'));
app.use('/api/groups',        require('./routes/groups'));
app.use('/api/game',          require('./routes/game'));
app.use('/api/color-profiles',require('./routes/colorProfiles'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/admin',         require('./routes/admin'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Error interno' },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀  API en http://localhost:${PORT}`));
