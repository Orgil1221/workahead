import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Student: submit a flag
router.post('/', async (req, res, next) => {
  try {
    const { questionId, reason } = req.body;
    if (!questionId || !reason?.trim())
      return res.status(400).json({ error: 'Асуулт болон шалтгаан шаардлагатай' });
    const flag = await prisma.flag.create({
      data: { questionId, userId: req.user.id, reason: reason.trim() },
    });
    res.status(201).json({ flag });
  } catch (e) { next(e); }
});

// Admin: reports queue
router.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status === 'RESOLVED' ? 'RESOLVED' : req.query.status === 'ALL' ? undefined : 'NEW';
    const flags = await prisma.flag.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        question: {
          include: {
            exam: { select: { title: true, year: true, variant: true } },
            _count: { select: { flags: true } },
          },
        },
      },
    });
    res.json({ flags });
  } catch (e) { next(e); }
});

// Admin: change flag status
router.patch('/admin/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const flag = await prisma.flag.update({
      where: { id: req.params.id },
      data: {
        ...(status ? { status } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
        ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
        ...(status === 'NEW' ? { resolvedAt: null } : {}),
      },
    });
    res.json({ flag });
  } catch (e) { next(e); }
});

export default router;
