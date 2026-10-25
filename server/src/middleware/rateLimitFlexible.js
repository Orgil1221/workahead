import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import crypto from 'node:crypto';

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
  chatMessage: createLimiter({ points: 20, duration: 60, keyPrefix: 'rl_chat_message' }),
  chatReaction: createLimiter({ points: 60, duration: 60, keyPrefix: 'rl_chat_reaction' }),
  chatTyping: createLimiter({ points: 40, duration: 60, keyPrefix: 'rl_chat_typing' }),
  chatInvite: createLimiter({ points: 10, duration: 60 * 60, keyPrefix: 'rl_chat_invite' }),
  chatReport: createLimiter({ points: 10, duration: 60 * 60, keyPrefix: 'rl_chat_report' }),
  usage: createLimiter({ points: 20, duration: 60, keyPrefix: 'rl_usage' }),
  auth: createLimiter({ points: 20, duration: 10 * 60, keyPrefix: 'rl_auth' }), // 20 per 10 min per IP (был 5/15мин — 727с түгжээ суллах)
  loginAccount: createLimiter({ points: 10, duration: 15 * 60, keyPrefix: 'rl_login_account' }),
  checkout: createLimiter({ points: 20, duration: 60 * 60, keyPrefix: 'rl_checkout' }), // 20 per hour per user
  general: createLimiter({ points: 200, duration: 60, keyPrefix: 'rl_general' }), // 200 per min per IP
};

export function rateLimitFlexible(type = 'general') {
  return async (req, res, next) => {
    // RATE_LIMIT_DISABLED only allowed in non-production
    if (process.env.RATE_LIMIT_DISABLED === '1') {
      if (process.env.NODE_ENV === 'production') {
        console.warn('RATE_LIMIT_DISABLED ignored in production');
      } else {
        return next();
      }
    }
    // Health/ping are mounted before the limiter. Never trust request headers
    // or route suffixes to exempt an authentication request.
    const limiter = limiters[type] || limiters.general;
    const email = String(req.body?.email || '').trim().toLowerCase();
    const key = type === 'loginAccount'
      ? crypto.createHash('sha256').update(email).digest('hex')
      : req.user?.id || req.ip;
    try {
      await limiter.consume(key);
      next();
    } catch (rej) {
      const secs = Math.round(rej.msBeforeNext / 1000) || 60;
      res.set('Retry-After', String(secs));
      res.status(429).json({ error: `Хэт олон хүсэлт — ${secs}с дараа дахин оролдоно уу` });
    }
  };
}

// Fallback for legacy usage: rateLimit({windowMs, max}) still works via memory
export { rateLimitFlexible as rateLimitNew };
