import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { revokeAdminDevices } from '../../services/adminMfa.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const take = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    if (cursor && !(await prisma.user.findUnique({ where: { id: cursor }, select: { id: true } })))
      return res.status(400).json({ error: 'Хуудасны зааг буруу байна' });
    const users = await prisma.user.findMany({
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, email: true, name: true, role: true, isActive: true, createdAt: true,
        program: { select: { id: true, name: true, school: true } },
        academicProgramId: true,
        academicProgram: { select: { id: true, university: true, school: true, name: true } },
        _count: { select: { attempts: true, flags: true } },
        payments: {
          where: { status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          orderBy: { expiresAt: 'desc' },
          take: 1,
          select: { provider: true, expiresAt: true, plan: { select: { title: true, code: true } } },
        },
      },
    });
    const hasMore = users.length > take;
    if (hasMore) users.pop();
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
    res.json({ users: mapped, nextCursor: hasMore ? users.at(-1)?.id || null : null });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { email, password, name, role, programId, academicProgramId } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: 'Имэйл, нууц үг, нэр шаардлагатай' });
    if (typeof password !== 'string' || password.length < 12 || password.length > 72)
      return res.status(400).json({ error: 'Нууц үг 12–72 тэмдэгт байх ёстой' });
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Энэ имэйл бүртгэлтэй байна' });
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 12),
        role: role === 'ADMIN' ? 'ADMIN' : 'STUDENT',
        programId: programId || null,
        academicProgramId: academicProgramId || null,
      },
      select: { id: true, email: true, name: true, role: true, programId: true, academicProgramId: true },
    });
    res.status(201).json({ user });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, role, programId, academicProgramId, password, isActive } = req.body;
    if (password !== undefined && (typeof password !== 'string' || password.length < 12 || password.length > 72))
      return res.status(400).json({ error: 'Шинэ нууц үг 12–72 тэмдэгт байх ёстой' });
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role: role === 'ADMIN' ? 'ADMIN' : 'STUDENT' }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...((role !== undefined || password || isActive === false) && { adminMfaVerifiedAt: null }),
        ...(programId !== undefined && { programId: programId || null }),
        ...(academicProgramId !== undefined && { academicProgramId: academicProgramId || null }),
        ...(passwordHash && { passwordHash }),
      },
      select: {
        id: true, email: true, name: true, role: true, programId: true, academicProgramId: true,
        academicProgram: { select: { id: true, university: true, school: true, name: true } },
      },
    });
    if (password || isActive === false || role !== undefined) {
      await tx.userSession.deleteMany({ where: { userId: updated.id } });
      await revokeAdminDevices(tx, updated);
    }
    return updated;
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
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { email: true } });
    if (!target) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: req.params.id }, data: { isActive: false, adminMfaVerifiedAt: null } });
      await tx.userSession.deleteMany({ where: { userId: req.params.id } });
      await revokeAdminDevices(tx, { id: req.params.id, email: target.email });
    });
    res.json({ ok: true, deactivated: true });
  } catch (e) { next(e); }
});

export default router;
