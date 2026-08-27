import { Router } from 'express';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    const now = new Date();
    const [mostFlagged, answerGroups, activeUsers, attemptCount, questionCount, newFlagCount, paidStats, giftStats, activePaid, activeGift] =
      await Promise.all([
        prisma.question.findMany({
          where: { flags: { some: {} } },
          orderBy: { flags: { _count: 'desc' } },
          take: 10,
          select: {
            id: true,
            prompt: true,
            points: true,
            exam: { select: { title: true } },
            _count: { select: { flags: true } },
          },
        }),
        // Anonymized student performance per answered question
        prisma.attemptAnswer.groupBy({
          by: ['questionId'],
          where: { attempt: { finishedAt: { not: null } } },
          _sum: { pointsEarned: true },
        }),
        prisma.user.count(),
        prisma.testAttempt.count(),
        prisma.question.count(),
        prisma.flag.count({ where: { status: 'NEW' } }),
        // Төлбөр төлсөн (GIFT биш) — нийт
        prisma.paymentTransaction.groupBy({
          by: ['userId'],
          where: { status: 'PAID', NOT: { provider: { in: ['GIFT', 'ADMIN_GIFT'] } } },
        }),
        // Gift — нийт
        prisma.paymentTransaction.groupBy({
          by: ['userId'],
          where: { status: 'PAID', provider: { in: ['GIFT', 'ADMIN_GIFT'] } },
        }),
        // Идэвхтэй төлбөрт
        prisma.paymentTransaction.groupBy({
          by: ['userId'],
          where: { status: 'PAID', NOT: { provider: { in: ['GIFT', 'ADMIN_GIFT'] } }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        }),
        // Идэвхтэй gift
        prisma.paymentTransaction.groupBy({
          by: ['userId'],
          where: { status: 'PAID', provider: { in: ['GIFT', 'ADMIN_GIFT'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        }),
      ]);

    const qIds = answerGroups.map((g) => g.questionId);
    const questions = await prisma.question.findMany({
      where: { id: { in: qIds } },
      select: { id: true, points: true, tags: true, topic: true },
    });
    const qMap = Object.fromEntries(questions.map((q) => [q.id, q]));

    const byTopic = {};
    for (const g of answerGroups) {
      const q = qMap[g.questionId];
      if (!q) continue;
      const topics = q.topic ? [q.topic] : q.tags.length ? [q.tags.slice(0, 1)] : [];
      for (const t of topics.flat()) {
        byTopic[t] ??= { earned: 0, possible: 0 };
        byTopic[t].earned += g._sum.pointsEarned ?? 0;
        byTopic[t].possible += q.points;
      }
    }
    const weakTopics = Object.entries(byTopic)
      .map(([topic, v]) => ({
        topic,
        percent: v.possible ? Math.round((v.earned / v.possible) * 100) : 0,
        answers: v.possible ? v.earned / v.possible : 0,
        possible: v.possible,
      }))
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 10);

    res.json({
      mostFlagged,
      weakTopics,
      totals: {
        users: activeUsers,
        attempts: attemptCount,
        questions: questionCount,
        newFlags: newFlagCount,
        paidUsers: paidStats.length,
        giftUsers: giftStats.length,
        activePaid: activePaid.length,
        activeGift: activeGift.length,
      },
    });
  } catch (e) { next(e); }
});

export default router;
