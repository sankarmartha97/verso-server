// Fixed-window rate limiter backed by Redis INCR + PEXPIRE. Keyed per-IP by default.
const redis = require('../infra/redis/client.js');
const { RateLimitError } = require('./errors.js');

function rateLimit({ windowMs, max, keyPrefix }) {
  return async (req, res, next) => {
    const key = `ratelimit:${keyPrefix}:${req.ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
    if (count > max) {
      const ttl = await redis.pttl(key);
      return next(new RateLimitError(Math.max(1, Math.ceil(ttl / 1000))));
    }
    next();
  };
}

module.exports = rateLimit;
