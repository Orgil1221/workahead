import { Router } from 'express';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const rows = await prisma.adminAuditLog.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, adminId: true, action: true, method: true, statusCode: true, createdAt: true },
    });
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    res.json({ entries: rows, nextCursor: hasMore ? rows.at(-1)?.id || null : null });
  } catch (error) { next(error); }
});
export default router;
