// Simple in-memory rate limiter (no external deps) — per IP sliding window.
const hits = new Map();

export function rateLimit({ windowMs = 10 * 60 * 1000, max = 20 } = {}) {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, arr] of hits) {
      const fresh = arr.filter((t) => now - t < windowMs);
      if (fresh.length === 0) hits.delete(ip); else hits.set(ip, fresh);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      return res.status(429).json({ error: 'Хэт олон оролдлоо. Түр хүлээгээд дахин орно уу.' });
    }
    arr.push(now);
    hits.set(ip, arr);
    next();
  };
}
