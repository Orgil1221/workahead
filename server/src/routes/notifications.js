import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// List — student: only global + own program; admin: all
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    const where = isAdmin ? {} : { OR: [{ programId: null }, { programId: req.user.programId }] };
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        program: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    res.json({ notifications });
  } catch (e) { next(e); }
});

// Admin: send notification to a program (or all)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { title, body, programId } = req.body;
    if (!title?.trim() || !body?.trim())
      return res.status(400).json({ error: 'Гарчиг болон агуулга шаардлагатай' });
    const notification = await prisma.notification.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        programId: programId || null,
        createdById: req.user.id,
      },
    });
    res.status(201).json({ notification });
  } catch (e) { next(e); }
});

// Admin: delete sent notification
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const exists = await prisma.notification.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: 'Мэдэгдэл олдсонгүй' });
    await prisma.notification.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
