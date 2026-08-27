import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    const now = new Date();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, name: true, role: true, createdAt: true,
        program: { select: { id: true, name: true, school: true } },
        _count: { select: { attempts: true, flags: true } },
        payments: {
          where: { status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          orderBy: { expiresAt: 'desc' },
          take: 1,
          select: { provider: true, expiresAt: true, plan: { select: { title: true, code: true } } },
        },
      },
    });
    const mapped = users.map((u) => {
      const sub = u.payments?.[0] || null;
      const { payments, ...rest } = u;
      return {
        ...rest,
        subscription: sub ? {
          provider: sub.provider,
          expiresAt: sub.expiresAt,
          title: sub.plan?.title,
          code: sub.plan?.code,
          isGift: sub.provider === 'GIFT' || sub.provider === 'ADMIN_GIFT',
        } : null,
      };
    });
    res.json({ users: mapped });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { email, password, name, role, programId } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: 'Имэйл, нууц үг, нэр шаардлагатай' });
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Энэ имэйл бүртгэлтэй байна' });
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        role: role === 'ADMIN' ? 'ADMIN' : 'STUDENT',
        programId: programId || null,
      },
      select: { id: true, email: true, name: true, role: true, programId: true },
    });
    res.status(201).json({ user });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, role, programId, password } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role: role === 'ADMIN' ? 'ADMIN' : 'STUDENT' }),
        ...(programId !== undefined && { programId: programId || null }),
        ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
      },
      select: { id: true, email: true, name: true, role: true, programId: true },
    });
    res.json({ user });
  } catch (e) { next(e); }
});

router.post('/:id/gift', async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { planId, days } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
    let plan = null;
    if (planId) plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) plan = await prisma.plan.findFirst({ where: { active: true }, orderBy: { priceMnt: 'asc' } });
    if (!plan) return res.status(404).json({ error: 'Багц олдсонгүй' });
    const duration = days ? Number(days) : (plan.durationDays || 30);
    const now = new Date();
    // Хэрэв идэвхтэй эрх байвал сунгах
    const active = await prisma.paymentTransaction.findFirst({
      where: { userId, status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { expiresAt: 'desc' },
    });
    const base = active?.expiresAt && new Date(active.expiresAt) > now ? new Date(active.expiresAt) : now;
    const expiresAt = new Date(base.getTime() + duration * 86400000);
    const gift = await prisma.paymentTransaction.create({
      data: {
        userId,
        planId: plan.id,
        transactionId: `gift-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        amount: 0,
        status: 'PAID',
        provider: 'GIFT',
        completedAt: now,
        expiresAt,
      },
    });
    res.status(201).json({ gift, expiresAt });
  } catch (e) { next(e); }
});

router.post('/:id/revoke', async (req, res, next) => {
  try {
    const userId = req.params.id;
    const now = new Date();
    const activeGift = await prisma.paymentTransaction.findFirst({
      where: { userId, status: 'PAID', provider: 'GIFT', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { expiresAt: 'desc' },
    });
    if (!activeGift) return res.status(404).json({ error: 'Идэвхтэй gift эрх олдсонгүй' });
    await prisma.paymentTransaction.update({ where: { id: activeGift.id }, data: { expiresAt: now, status: 'REVOKED' } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'Өөрийн бүртгэлийг устгаж болохгүй' });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
