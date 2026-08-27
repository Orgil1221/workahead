import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    redisClient.on('error', () => { redisClient = null; });
  } catch { redisClient = null; }
}

function createLimiter({ points, duration, keyPrefix }) {
  const opts = { points, duration, keyPrefix };
  if (redisClient) {
    return new RateLimiterRedis({ ...opts, storeClient: redisClient, insuranceLimiter: new RateLimiterMemory(opts) });
  }
  return new RateLimiterMemory(opts);
}

const limiters = {
  auth: createLimiter({ points: 5, duration: 15 * 60, keyPrefix: 'rl_auth' }), // 5 per 15 min per IP
  checkout: createLimiter({ points: 10, duration: 60 * 60, keyPrefix: 'rl_checkout' }), // 10 per hour per user
  general: createLimiter({ points: 100, duration: 60, keyPrefix: 'rl_general' }), // 100 per min per IP
};

export function rateLimitFlexible(type = 'general') {
  // Түр унтраах: .env дээр RATE_LIMIT_DISABLED=1 бол бүх rate limit идэвхгүй болно
  if (process.env.RATE_LIMIT_DISABLED === '1') {
    return (_req, _res, next) => next();
  }
  const limiter = limiters[type] || limiters.general;
  return async (req, res, next) => {
    const key = type === 'checkout' && req.user?.id ? req.user.id : (req.ip || req.socket?.remoteAddress || 'unknown');
    try {
      await limiter.consume(key);
      next();
    } catch (rej) {
      const secs = Math.round(rej.msBeforeNext / 1000) || 60;
      res.set('Retry-After', String(secs));
      return res.status(429).json({ error: `Хэт олон хүсэлт. ${secs} секундын дараа дахин орно уу.` });
    }
  };
}

// Fallback for legacy usage: rateLimit({windowMs, max}) still works via memory
export { rateLimitFlexible as rateLimitNew };
