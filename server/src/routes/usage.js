import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimitFlexible } from '../middleware/rateLimitFlexible.js';
import { recordUsage } from '../services/usage.js';

const router = Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Зөвхөн оюутны ашиглалтыг бүртгэнэ.' });
  next();
});
router.use(rateLimitFlexible('usage'));

router.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ serverTime: Date.now() });
});

router.post('/', async (req, res, next) => {
  try {
    await recordUsage(prisma, req.user.id, req.body?.intervals);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

export default router;
