import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimitFlexible } from '../middleware/rateLimitFlexible.js';
import { validate } from '../middleware/validate.js';
import { generateOtp, sendOtpEmail } from '../services/email.js';

const router = Router();
const authLimiter = rateLimitFlexible('auth');
const sign = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('wa_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}
function clearAuthCookie(res) {
  res.clearCookie('wa_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/' });
  res.clearCookie('x-csrf-token', { sameSite: 'Lax', secure: false, path: '/' });
}

const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Имэйл буруу байна').max(120),
    password: z.string().min(8, 'Нууц үг хамгийн багадаа 8 тэмдэгт').max(72),
    name: z.string().min(2, 'Нэр хамгийн багадаа 2 тэмдэгт').max(60),
    programId: z.string().min(1).max(60).nullable().optional().or(z.literal('')),
    customProgram: z.string().min(2, 'Мэргэжлийн нэр хамгийн багадаа 2 тэмдэгт').max(80).optional(),
    school: z.string().max(30).optional(),
    otp: z.string().min(6).max(6).optional(),
  }),
});
const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Имэйл буруу байна'),
    password: z.string().min(1, 'Нууц үг шаардлагатай'),
  }),
});

// Pre-registration OTP — business mail (Resend) 60s cooldown, 10min expiry
router.post('/send-register-otp', authLimiter, validate(otpSendSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Энэ имэйл бүртгэлтэй байна' });
    const existing = await prisma.emailOtp.findUnique({ where: { email } });
    if (existing && new Date(existing.expires).getTime() - Date.now() > 9 * 60 * 1000) {
      return res.status(429).json({ error: '1 минутын дараа дахин илгээнэ үү' });
    }
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.emailOtp.upsert({ where: { email }, update: { otp, expires }, create: { email, otp, expires } });
    await sendOtpEmail(email, otp);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, programId, customProgram, school, otp } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Энэ имэйл бүртгэлтэй байна' });
    // OTP заавал — бүртгүүлэх үед мэйл баталгаажуулна
    if (!otp) return res.status(400).json({ error: 'OTP код оруулна уу — Code илгээх дарж мэйлээ баталгаажуулна уу' });
    const stored = await prisma.emailOtp.findUnique({ where: { email } });
    if (!stored || !stored.otp) return res.status(400).json({ error: 'OTP үүсээгүй — Code илгээх дарна уу' });
    if (new Date() > new Date(stored.expires)) return res.status(400).json({ error: 'OTP хугацаа дууссан — дахин илгээнэ үү' });
    if (String(stored.otp) !== String(otp).trim()) return res.status(400).json({ error: 'OTP буруу' });
    const finalProgramId = await resolveProgramId({ programId, customProgram, school });
    if (customProgram?.trim() && !finalProgramId)
      return res.status(400).json({ error: 'Мэргэжил үүсгэж чадсангүй — дахин оролдоно уу' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'STUDENT', programId: finalProgramId, isVerified: true },
      include: { program: { select: { id: true, name: true, school: true, code: true } } },
    });
    await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
    const token = sign(user);
    setAuthCookie(res, token);
    res.status(201).json({ token, user: safe(user) });
  } catch (e) { next(e); }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { program: { select: { id: true, name: true, school: true, code: true } } },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: 'Имэйл эсвэл нууц үг буруу' });
    const token = sign(user);
    setAuthCookie(res, token);
    res.json({ token, user: safe(user) });
  } catch (e) { next(e); }
});

const otpSendSchema = z.object({ body: z.object({ email: z.string().email('Имэйл буруу') }) });
const otpVerifySchema = z.object({ body: z.object({ email: z.string().email('Имэйл буруу'), otp: z.string().min(6).max(6) }) });

// OTP дахин илгээх — 1 минут тутамд 1 удаа
router.post('/send-otp', authLimiter, validate(otpSendSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
    if (user.isVerified) return res.json({ ok: true, alreadyVerified: true });
    // 1 минут дотор дахин илгээхгүй
    if (user.verifyExpires && user.verifyOtp && new Date(user.verifyExpires).getTime() - Date.now() > 9 * 60 * 1000) {
      return res.status(429).json({ error: '1 минутын дараа дахин илгээнэ үү' });
    }
    const otp = generateOtp();
    const verifyExpires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { verifyOtp: otp, verifyExpires } });
    await sendOtpEmail(email, otp);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/verify-otp', authLimiter, validate(otpVerifySchema), async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
    if (user.isVerified) return res.json({ ok: true, alreadyVerified: true });
    if (!user.verifyOtp || !user.verifyExpires) return res.status(400).json({ error: 'OTP үүсээгүй — дахин илгээнэ үү' });
    if (new Date() > new Date(user.verifyExpires)) return res.status(400).json({ error: 'OTP хугацаа дууссан — дахин илгээнэ үү' });
    if (String(user.verifyOtp) !== String(otp).trim()) return res.status(400).json({ error: 'OTP буруу' });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verifyOtp: null, verifyExpires: null },
      include: { program: { select: { id: true, name: true, school: true, code: true } } },
    });
    const token = sign(updated);
    setAuthCookie(res, token);
    res.json({ ok: true, token, user: safe(updated) });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: safe(req.user) }));

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

const profileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(60).optional(),
    phone: z.string().max(20).nullable().optional(),
    programId: z.string().min(1).max(60).nullable().optional().or(z.literal('')),
    customProgram: z.string().min(2, 'Мэргэжлийн нэр хамгийн багадаа 2 тэмдэгт').max(80).optional(),
    school: z.string().max(30).optional(),
  }),
});

// programId өгөгдсөн бол шууд, үгүй бол customProgram-оор мэргэжил олж/үүсгэж буцаана.
// Custom мэргэжил салбар сургуультай үүсэх тул нүүр хуудасны хичээлийн жагсаалтад орохгүй,
// зөвхөн бүртгэл/профайл/админы мэргэжлийн сонголтод нэмэгдэнэ.
async function resolveProgramId({ programId, customProgram, school }) {
  if (programId) {
    const p = await prisma.program.findUnique({ where: { id: programId } });
    if (!p) return null;
    return p.id;
  }
  const name = customProgram?.trim();
  if (!name) return null;
  const sch = school?.trim() || null;
  const existing = await prisma.program.findFirst({ where: { name, school: sch } });
  if (existing) return existing.id;
  const uni = await prisma.university.findFirst({ where: { shortName: 'МУИС' } })
    || await prisma.university.findFirst();
  const created = await prisma.program.create({
    data: { name, school: sch, universityId: uni?.id },
  });
  return created.id;
}
const passwordSchema = z.object({
  body: z.object({
    current: z.string().min(1, 'Одоогийн нууц үг шаардлагатай'),
    next: z.string().min(8, 'Шинэ нууц үг хамгийн багадаа 8 тэмдэгт').max(72),
  }),
});

router.put('/profile', requireAuth, validate(profileSchema), async (req, res, next) => {
  try {
    const { name, phone, programId, customProgram, school } = req.body || {};
    const data = {};
    if (name?.trim()) data.name = name.trim();
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (programId !== undefined || customProgram !== undefined) {
      const finalProgramId = await resolveProgramId({ programId, customProgram, school });
      if (customProgram?.trim() && !finalProgramId)
        return res.status(400).json({ error: 'Мэргэжил үүсгэж чадсангүй — дахин оролдоно уу' });
      data.programId = finalProgramId;
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: { program: { select: { id: true, name: true, school: true, code: true } } },
    });
    res.json({ user: safe(user) });
  } catch (e) { next(e); }
});

router.post('/password', requireAuth, validate(passwordSchema), async (req, res, next) => {
  try {
    const { current, next: newPass } = req.body || {};
    const u = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!u || !(await bcrypt.compare(current || '', u.passwordHash)))
      return res.status(400).json({ error: 'Одоогийн нууц үг буруу' });
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(newPass, 10) },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

function safe(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

export default router;
