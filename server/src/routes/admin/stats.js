import { Router } from 'express';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    const now = new Date();
    const [mostFlagged, activeUsers, attemptCount, questionCount, newFlagCount, paidStats, giftStats, activePaid, activeGift] =
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

    res.json({
      mostFlagged,
      weakTopics: [],
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
