// Singleton Redis client, shared by rate limiting and (later) pub/sub + awareness.
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

module.exports = redis;
