import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  isPushConfigured,
  getVapidPublicKey,
  sendPushToUsers,
  sendPushToSubscription,
} from '../services/push.js';

const router = Router();
router.use(requireAuth);

// VAPID public key — frontend subscribe-д хэрэгтэй (auth-тай, нууц биш)
router.get('/public-key', (req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(503).json({ error: 'Push тохируулагдаагүй байна (VAPID)' });
  res.json({ publicKey: key });
});

// Өөрийн төхөөрөмж бүртгэх (subscribe)
const subscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url().max(2000),
    p256dh: z.string().min(10).max(300),
    auth: z.string().min(10).max(300),
  }),
});
router.post('/subscribe', validate(subscribeSchema), async (req, res, next) => {
  try {
    if (!isPushConfigured()) return res.status(503).json({ error: 'Push тохируулагдаагүй байна (VAPID)' });
    const { endpoint, p256dh, auth } = req.body;
    const userAgent = req.headers['user-agent']?.slice(0, 300) || null;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.user.id, p256dh, auth, userAgent },
      create: { userId: req.user.id, endpoint, p256dh, auth, userAgent },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Өөрийн төхөөрөмж хасах (unsubscribe)
const unsubscribeSchema = z.object({
  body: z.object({ endpoint: z.string().url().max(2000) }),
});
router.post('/unsubscribe', validate(unsubscribeSchema), async (req, res, next) => {
  try {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: req.body.endpoint, userId: req.user.id },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Миний бүртгэлтэй төхөөрөмжүүд
router.get('/my', async (req, res, next) => {
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: req.user.id },
      select: { endpoint: true, userAgent: true, createdAt: true },
    });
    res.json({ subscriptions: subs, count: subs.length, configured: isPushConfigured() });
  } catch (e) { next(e); }
});

// Тест push — зөвхөн өөрийн бүх төхөөрөмж рүү (хэрэглэгч өөрөө туршина)
const testSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(120).default('WorkAhead тест'),
    body: z.string().trim().min(1).max(500).default('Push notification ажиллаж байна!'),
  }),
});
router.post('/test', validate(testSchema), async (req, res, next) => {
  try {
    if (!isPushConfigured()) return res.status(503).json({ error: 'Push тохируулагдаагүй байна (VAPID)' });
    const { title, body } = req.body;
    const result = await sendPushToUsers([req.user.id], { title, body, url: '/student/notifications' });
    if (result.total === 0) {
      return res.status(400).json({ error: 'Энэ төхөөрөмж бүртгэлгүй байна — эхлээд «Push асаах» дарна уу' });
    }
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

// Admin: сонгосон хэрэглэгчдэд push (1-1ээр эсвэл олноор) — Notify хуудасны тест/илгээлтэд
const adminSendSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(500),
    userIds: z.array(z.string().cuid()).min(1).max(100),
  }),
});
router.post('/admin/send', requireAdmin, validate(adminSendSchema), async (req, res, next) => {
  try {
    if (!isPushConfigured()) return res.status(503).json({ error: 'Push тохируулагдаагүй байна (VAPID)' });
    const { title, body, userIds } = req.body;
    const result = await sendPushToUsers(userIds, { title, body, url: '/student/notifications' });
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

export default router;
