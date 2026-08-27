import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { createInvoice, verifyChecksum, isConfigured } from '../services/bonum.js';
import { rateLimitFlexible } from '../middleware/rateLimitFlexible.js';
import { validate } from '../middleware/validate.js';

const checkoutSchema = z.object({
  body: z.object({ planId: z.string().cuid('Багц ID буруу') }),
});

const router = Router();

router.get('/plans', requireAuth, async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      include: { _count: { select: { exams: true } } },
      orderBy: { priceMnt: 'asc' },
    });
    const now = new Date();
    const paid = await prisma.paymentTransaction.findMany({
      where: { userId: req.user.id, status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { planId: true, expiresAt: true },
    });
    const ownedMap = new Map(paid.map((t) => [t.planId, t.expiresAt]));
    res.json({
      configured: isConfigured(),
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        description: p.description,
        priceMnt: p.priceMnt,
        durationDays: p.durationDays,
        examCount: p._count.exams,
        owned: ownedMap.has(p.id),
        expiresAt: ownedMap.get(p.id) || null,
      })),
    });
  } catch (e) { next(e); }
});

router.post('/checkout', requireAuth, rateLimitFlexible('checkout'), validate(checkoutSchema), async (req, res, next) => {
  try {
    const { planId } = req.body || {};
    const plan = await prisma.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) return res.status(404).json({ error: 'Багц олдсонгүй' });

    const now = new Date();
    const existing = await prisma.paymentTransaction.findFirst({
      where: { userId: req.user.id, planId: plan.id, status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    });
    if (existing) {
      const daysLeft = existing.expiresAt ? Math.ceil((new Date(existing.expiresAt) - now) / 86400000) : null;
      return res.status(409).json({ error: daysLeft ? `Багц идэвхтэй байна — ${daysLeft} хоног үлдсэн` : 'Энэ багц аль хэдийн худалдаж авсан' });
    }

    const transactionId = `wa-${crypto.randomBytes(8).toString('hex')}`;
    const txn = await prisma.paymentTransaction.create({
      data: {
        userId: req.user.id,
        planId: plan.id,
        transactionId,
        amount: plan.priceMnt,
        status: 'PENDING',
      },
    });

    if (!isConfigured())
      return res.status(503).json({ error: 'Төлбөрийн систем тохируулаагүй байна' });

    const callbackUrl = `${process.env.PUBLIC_BASE_URL || ''}/student/profile?payment=return&txn=${transactionId}`;
    const invoice = await createInvoice({
      amount: plan.priceMnt,
      transactionId,
      callbackUrl,
    });

    await prisma.paymentTransaction.update({
      where: { id: txn.id },
      data: { invoiceId: invoice.invoiceId },
    });

    res.json({ followUpLink: invoice.followUpLink, transactionId });
  } catch (e) { next(e); }
});

router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const transactions = await prisma.paymentTransaction.findMany({
      where: { userId: req.user.id },
      include: { plan: { select: { title: true, durationDays: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ transactions });
  } catch (e) { next(e); }
});

router.get('/status/:transactionId', requireAuth, async (req, res, next) => {
  try {
    const txn = await prisma.paymentTransaction.findFirst({
      where: { transactionId: req.params.transactionId, userId: req.user.id },
      select: { status: true, amount: true, expiresAt: true, plan: { select: { title: true } } },
    });
    if (!txn) return res.status(404).json({ error: 'Гүйлгээ олдсонгүй' });
    res.json({ transaction: txn });
  } catch (e) { next(e); }
});

// Bonum server-to-server webhook — no JWT; authenticated via x-checksum-v2 HMAC.
router.post('/webhook', async (req, res, next) => {
  try {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
    if (!verifyChecksum(raw, req.get('x-checksum-v2')))
      return res.status(401).json({ error: 'Checksum буруу' });

    const msg = typeof req.body === 'object' && Buffer.isBuffer(req.body)
      ? JSON.parse(raw)
      : req.body;
    const { type, status, body } = msg || {};

    if ((type === 'PAYMENT' || type === 'SUBSCRIPTION-PAYMENT') && body?.transactionId) {
      if (status === 'SUCCESS') {
        const completedAt = body.completedAt ? new Date(body.completedAt.replace(' ', 'T') + 'Z') : new Date();
        // durationDays-г plan-аас авч expiresAt тооцох
        const txn = await prisma.paymentTransaction.findFirst({ where: { transactionId: String(body.transactionId) }, select: { planId: true } });
        let expiresAt = null;
        if (txn?.planId) {
          const plan = await prisma.plan.findUnique({ where: { id: txn.planId }, select: { durationDays: true } });
          const days = plan?.durationDays || 30;
          expiresAt = new Date(completedAt.getTime() + days * 86400000);
        } else {
          expiresAt = new Date(completedAt.getTime() + 30 * 86400000);
        }
        await prisma.paymentTransaction.updateMany({
          where: { transactionId: String(body.transactionId), status: 'PENDING' },
          data: {
            status: 'PAID',
            invoiceId: body.invoiceId != null ? String(body.invoiceId) : undefined,
            provider: body.paymentVendor ?? 'CARD',
            completedAt,
            expiresAt,
          },
        });
      } else {
        await prisma.paymentTransaction.updateMany({
          where: { transactionId: String(body.transactionId), status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
