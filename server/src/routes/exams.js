import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { userHasExamAccess, paymentRequired } from '../services/access.js';

const router = Router();

// Exam detail — questions without solutions (answers revealed only after attempt finishes)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: {
        program: { select: { id: true, name: true, university: { select: { name: true } } } },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { flags: true } },
          },
        },
      },
    });
    if (!exam) return res.status(404).json({ error: 'Шалгалт олдсонгүй' });

    const hasAccess = await userHasExamAccess(req.user.id, exam.id);
    if (!hasAccess) {
      const planExam = await prisma.planExam.findFirst({
        where: { examId: exam.id },
        include: { plan: { select: { title: true } } },
      });
      return next(paymentRequired(planExam?.plan?.title));
    }

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user.id, questionId: { in: exam.questions.map((q) => q.id) } },
      select: { questionId: true },
    });
    const bookmarked = new Set(bookmarks.map((b) => b.questionId));

    res.json({
      exam: {
        ...exam,
        questions: exam.questions.map((q) => ({
          id: q.id,
          order: q.order,
          type: q.type,
          topic: q.topic,
          level: q.level,
          year: q.year,
          points: q.points,
          prompt: q.prompt,
          tags: q.tags,
          flagCount: q._count.flags,
          bookmarked: bookmarked.has(q.id),
          // тест горимд ашиглах сонголтууд — type test эсвэл open-д choices үүссэн бол тестэд хэрэглэнэ
          choices: q.choices && Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : undefined,
        })),
      },
    });
  } catch (e) { next(e); }
});

// Solution lookup for bookmarked questions (student-facing)
router.get('/solution/:questionId', requireAuth, async (req, res, next) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.questionId },
      select: { modelSolution: true, answer: true },
    });
    if (!question) return res.status(404).json({ error: 'Асуулт олдсонгүй' });
    res.json(question);
  } catch (e) { next(e); }
});

export default router;
