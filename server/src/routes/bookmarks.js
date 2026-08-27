import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        question: {
          select: { id: true, prompt: true, points: true, topic: true, year: true, examId: true,
            exam: { select: { title: true } } },
        },
      },
    });
    res.json({ bookmarks });
  } catch (e) { next(e); }
});

router.post('/:questionId', async (req, res, next) => {
  try {
    await prisma.bookmark.upsert({
      where: { userId_questionId: { userId: req.user.id, questionId: req.params.questionId } },
      update: {},
      create: { userId: req.user.id, questionId: req.params.questionId },
    });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:questionId', async (req, res, next) => {
  try {
    await prisma.bookmark.delete({
      where: { userId_questionId: { userId: req.user.id, questionId: req.params.questionId } },
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.json({ ok: true });
    next(e);
  }
});

export default router;
