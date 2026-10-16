import { Router } from 'express';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { readUsage } from '../../services/usage.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/', async (req, res, next) => {
  try {
    const report = await readUsage(prisma, Number(req.query.days || 7));
    res.set('Cache-Control', 'no-store');
    res.json(report);
  } catch (error) { next(error); }
});
export default router;
