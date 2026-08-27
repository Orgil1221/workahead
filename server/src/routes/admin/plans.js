import { Router } from 'express';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceMnt: 'asc' },
      include: { _count: { select: { exams: true, transactions: true } } },
    });
    res.json({ plans });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, description, priceMnt, durationDays, active } = req.body;
    const data = {};
    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (priceMnt !== undefined) {
      const p = Number(priceMnt);
      if (isNaN(p) || p < 0) return res.status(400).json({ error: 'Үнэ буруу' });
      data.priceMnt = Math.round(p);
    }
    if (durationDays !== undefined) {
      const d = Number(durationDays);
      if (isNaN(d) || d < 1 || d > 365) return res.status(400).json({ error: 'Хугацаа 1-365 хоног' });
      data.durationDays = Math.round(d);
    }
    if (active !== undefined) data.active = Boolean(active);
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data });
    res.json({ plan });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { code, title, description, priceMnt, durationDays } = req.body;
    if (!code || !title) return res.status(400).json({ error: 'code, title шаардлагатай' });
    const plan = await prisma.plan.create({
      data: {
        code: String(code).trim(),
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        priceMnt: priceMnt ? Math.round(Number(priceMnt)) : 6999,
        durationDays: durationDays ? Math.round(Number(durationDays)) : 30,
      },
    });
    res.status(201).json({ plan });
  } catch (e) { next(e); }
});

export default router;
