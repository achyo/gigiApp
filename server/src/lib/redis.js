const { createClient } = require('redis');

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', e => console.error('Redis error:', e));
redis.connect().then(() => console.log('✅  Redis conectado'));

module.exports = { redis };
