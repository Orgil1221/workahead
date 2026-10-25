import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { clearCsrfCookies } from '../middleware/csrf.js';
import { rateLimitFlexible } from '../middleware/rateLimitFlexible.js';
import { validate } from '../middleware/validate.js';
import { generateOtp, sendOtpEmail as deliverOtpEmail } from '../services/email.js';
import { createSession, destroySessionByJti } from '../services/session.js';
import { otpDigest, otpMatches } from '../services/otp.js';
import { ADMIN_OTP_RECIPIENT, createAdminMfa, clearAdminChallenge, revokeAdminDevices } from '../services/adminMfa.js';

export function createAuthRouter({ sendOtpEmail = deliverOtpEmail, clock = () => new Date() } = {}) {
const router = Router();
const adminMfa = createAdminMfa({ db: prisma, sendEmail: sendOtpEmail, now: clock });
const authLimiter = rateLimitFlexible('auth');
const OTP_MAX_ATTEMPTS = 5;
function otpAttemptError(attempts) {
  return attempts >= OTP_MAX_ATTEMPTS
    ? 'Оролдлогын хязгаар хүрлээ — шинэ код хүснэ үү'
    : 'OTP буруу';
}
// jti = session ID — 1 user + 1 deviceType (DESKTOP/MOBILE) тутамд 1 session.
// Шинэ төхөөрөмж нэвтрэхэд хуучин jti устгагдаж, хуучин token 401 DEVICE_KICKED болно.
const sign = (user, jti, device) => {
  if (user.role === 'ADMIN' && !device) throw new Error('Admin MFA proof required');
  const exp = Math.floor((device ? device.expiresAt.getTime() : clock().getTime() + 7 * 24 * 3600000) / 1000);
  if (exp <= Math.floor(clock().getTime() / 1000)) throw Object.assign(new Error('Баталгаажуулалтын хугацаа дууссан'), { status: 401 });
  return jwt.sign({ sub: user.id, role: user.role, jti, exp, ...(device && { adminDeviceId: device.id }) }, process.env.JWT_SECRET, { algorithm: 'HS256' });
};

function setAuthCookie(res, token, expiresAt) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('wa_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Strict',
    maxAge: expiresAt ? Math.max(0, expiresAt.getTime() - clock().getTime()) : 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}
function clearAuthCookie(res) {
  res.clearCookie('wa_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/' });
  clearCsrfCookies(res);
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
    email: z.string().email('Имэйл буруу байна').max(120),
    password: z.string().min(1, 'Нууц үг шаардлагатай').max(72),
  }),
});
const otpSendSchema = z.object({ body: z.object({ email: z.string().email('Имэйл буруу') }) });
const otpVerifySchema = z.object({ body: z.object({ email: z.string().email('Имэйл буруу'), otp: z.string().min(6).max(6) }) });
const adminLoginOtpSchema = z.object({ body: z.object({ email: z.string().email().max(120), otp: z.string().regex(/^\d{6}$/) }) });
const forgotSchema = z.object({ body: z.object({ email: z.string().email('Имэйл буруу') }) });
const resetSchema = z.object({
  body: z.object({
    email: z.string().email('Имэйл буруу'),
    otp: z.string().min(6, 'OTP 6 оронтой').max(6),
    newPassword: z.string().min(12, 'Нууц үг хамгийн багадаа 12 тэмдэгт').max(72),
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
    await prisma.emailOtp.upsert({ where: { email }, update: { otp: null, otpHash: otpDigest(email, otp), attempts: 0, expires }, create: { email, otpHash: otpDigest(email, otp), expires } });
    await sendOtpEmail(email, otp, 'register');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Нууц үг мартсан — OTP илгээх (enumeration-ээс хамгаалж үргэлж ok:true)
router.post('/forgot-password', authLimiter, rateLimitFlexible('loginAccount'), validate(forgotSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Хэрэглэгч байхгүй ч ok:true буцаана — имэйл байгаа эсэхийг битгий илчилнэ
    if (!user) return res.json({ ok: true });
    const existing = await prisma.emailOtp.findUnique({ where: { email } });
    if (existing && new Date(existing.expires).getTime() - Date.now() > 9 * 60 * 1000) {
      return res.status(429).json({ error: '1 минутын дараа дахин илгээнэ үү' });
    }
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.emailOtp.upsert({ where: { email }, update: { otp: null, otpHash: otpDigest(email, otp), attempts: 0, expires }, create: { email, otpHash: otpDigest(email, otp), expires } });
    await sendOtpEmail(user.role === 'ADMIN' ? ADMIN_OTP_RECIPIENT : email, otp, 'reset');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// OTP баталгаажуулж шинэ нууц үг үүсгэх
router.post('/reset-password', authLimiter, rateLimitFlexible('loginAccount'), validate(resetSchema), async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'OTP буруу эсвэл хугацаа дууссан' });
    const stored = await prisma.emailOtp.findUnique({ where: { email } });
    if (!stored || !stored.otpHash || stored.attempts >= OTP_MAX_ATTEMPTS) return res.status(400).json({ error: 'OTP үүсээгүй эсвэл оролдлогын хязгаар хүрсэн — Code илгээх дарна уу' });
    if (new Date() > new Date(stored.expires)) return res.status(400).json({ error: 'OTP хугацаа дууссан — дахин илгээнэ үү' });
    const { count } = await prisma.emailOtp.updateMany({ where: { email, otpHash: stored.otpHash, attempts: { lt: OTP_MAX_ATTEMPTS }, expires: { gt: new Date() } }, data: { attempts: { increment: 1 } } });
    if (!count) return res.status(400).json({ error: 'OTP буруу эсвэл хугацаа дууссан' });
    if (!otpMatches(email, otp, stored.otpHash)) {
      const latest = await prisma.emailOtp.findUnique({ where: { email }, select: { attempts: true } });
      if (latest?.attempts >= OTP_MAX_ATTEMPTS) await prisma.emailOtp.deleteMany({ where: { email, otpHash: stored.otpHash } });
      return res.status(400).json({ error: otpAttemptError(latest?.attempts || stored.attempts + 1) });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailOtp.deleteMany({ where: { email, otpHash: stored.otpHash, expires: { gt: new Date() } } });
      if (consumed.count !== 1) throw Object.assign(new Error('OTP ашиглагдсан эсвэл хугацаа дууссан'), { status: 400 });
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, adminMfaVerifiedAt: null } });
      await tx.userSession.deleteMany({ where: { userId: user.id } });
      await revokeAdminDevices(tx, user);
    });
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
    if (!stored || !stored.otpHash || stored.attempts >= OTP_MAX_ATTEMPTS) return res.status(400).json({ error: 'OTP үүсээгүй эсвэл оролдлогын хязгаар хүрсэн — Code илгээх дарна уу' });
    if (new Date() > new Date(stored.expires)) return res.status(400).json({ error: 'OTP хугацаа дууссан — дахин илгээнэ үү' });
    const { count } = await prisma.emailOtp.updateMany({ where: { email, otpHash: stored.otpHash, attempts: { lt: OTP_MAX_ATTEMPTS }, expires: { gt: new Date() } }, data: { attempts: { increment: 1 } } });
    if (!count) return res.status(400).json({ error: 'OTP буруу эсвэл хугацаа дууссан' });
    if (!otpMatches(email, otp, stored.otpHash)) {
      const latest = await prisma.emailOtp.findUnique({ where: { email }, select: { attempts: true } });
      if (latest?.attempts >= OTP_MAX_ATTEMPTS) await prisma.emailOtp.deleteMany({ where: { email, otpHash: stored.otpHash } });
      return res.status(400).json({ error: otpAttemptError(latest?.attempts || stored.attempts + 1) });
    }
    // Бүртгэлийн салбар/хөтөлбөр — AcademicProgram (шалгалтын Program-аас тусдаа)
    const finalAcademicId = await resolveAcademicProgramId({ programId, customProgram, school });
    if (customProgram?.trim() && !finalAcademicId)
      return res.status(400).json({ error: 'Мэргэжил үүсгэж чадсангүй — дахин оролдоно уу' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'STUDENT', academicProgramId: finalAcademicId, isVerified: true },
      include: {
        program: { select: { id: true, name: true, school: true, code: true } },
        academicProgram: { select: { id: true, name: true, school: true, code: true, university: true } },
      },
    });
    await prisma.emailOtp.deleteMany({ where: { email, otpHash: stored.otpHash } });
    const jti = crypto.randomUUID();
    await createSession(user.id, req, jti);
    const token = sign(user, jti);
    setAuthCookie(res, token);
    res.status(201).json({ user: safe(user) });
  } catch (e) { next(e); }
});

router.post('/login', authLimiter, rateLimitFlexible('loginAccount'), validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        program: { select: { id: true, name: true, school: true, code: true } },
        academicProgram: { select: { id: true, name: true, school: true, code: true, university: true } },
      },
    });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: 'Имэйл эсвэл нууц үг буруу' });
    let device;
    if (user.role === 'ADMIN') {
      const result = await adminMfa.begin(user, req, res);
      if (result.mfaRequired) return res.json(result);
      device = result.device;
    }
    const jti = crypto.randomUUID();
    await createSession(user.id, req, jti, device?.expiresAt);
    const token = sign(user, jti, device);
    setAuthCookie(res, token, device?.expiresAt);
    req.user = user;
    res.json({ user: safe(user) });
  } catch (e) { next(e); }
});

router.post('/verify-admin-login', authLimiter, rateLimitFlexible('loginAccount'), validate(adminLoginOtpSchema), async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const { user, device } = await adminMfa.verify(email, otp, req, res);
    const fullUser = await prisma.user.findUnique({ where: { id: user.id }, include: {
      program: { select: { id: true, name: true, school: true, code: true } },
      academicProgram: { select: { id: true, name: true, school: true, code: true, university: true } },
    } });
    const jti = crypto.randomUUID();
    await createSession(fullUser.id, req, jti, device.expiresAt);
    setAuthCookie(res, sign(fullUser, jti, device), device.expiresAt);
    req.user = fullUser;
    return res.json({ user: safe(fullUser) });
  } catch (e) { next(e); }
});

// OTP дахин илгээх — 1 минут тутамд 1 удаа
router.post('/send-otp', authLimiter, validate(otpSendSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
    if (user.isVerified) return res.json({ ok: true, alreadyVerified: true });
    // 1 минут дотор дахин илгээхгүй
    if (user.verifyExpires && user.verifyOtpHash && new Date(user.verifyExpires).getTime() - Date.now() > 9 * 60 * 1000) {
      return res.status(429).json({ error: '1 минутын дараа дахин илгээнэ үү' });
    }
    const otp = generateOtp();
    const verifyExpires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { verifyOtp: null, verifyOtpHash: otpDigest(email, otp), verifyOtpAttempts: 0, verifyExpires } });
    await sendOtpEmail(email, otp, 'verify');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/verify-otp', authLimiter, validate(otpVerifySchema), async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
    if (user.role === 'ADMIN' || !user.isActive) return res.status(403).json({ error: 'Нэвтрэх хуудаснаас нууц үг болон админы кодоор нэвтэрнэ үү' });
    if (user.isVerified) return res.json({ ok: true, alreadyVerified: true });
    if (!user.verifyOtpHash || !user.verifyExpires || user.verifyOtpAttempts >= OTP_MAX_ATTEMPTS) return res.status(400).json({ error: 'OTP үүсээгүй эсвэл оролдлогын хязгаар хүрсэн — дахин илгээнэ үү' });
    if (new Date() > new Date(user.verifyExpires)) return res.status(400).json({ error: 'OTP хугацаа дууссан — дахин илгээнэ үү' });
    const attempt = await prisma.user.updateMany({ where: { id: user.id, isVerified: false, verifyOtpHash: user.verifyOtpHash, verifyOtpAttempts: { lt: OTP_MAX_ATTEMPTS }, verifyExpires: { gt: new Date() } }, data: { verifyOtpAttempts: { increment: 1 } } });
    if (!attempt.count) return res.status(400).json({ error: 'OTP буруу эсвэл хугацаа дууссан' });
    if (!otpMatches(email, otp, user.verifyOtpHash)) {
      const latest = await prisma.user.findUnique({ where: { id: user.id }, select: { verifyOtpAttempts: true } });
      if (latest?.verifyOtpAttempts >= OTP_MAX_ATTEMPTS) await prisma.user.updateMany({ where: { id: user.id, verifyOtpHash: user.verifyOtpHash }, data: { verifyOtpHash: null, verifyExpires: null } });
      return res.status(400).json({ error: otpAttemptError(latest?.verifyOtpAttempts || user.verifyOtpAttempts + 1) });
    }
    const updatedRows = await prisma.user.updateMany({ where: { id: user.id, isVerified: false, verifyOtpHash: user.verifyOtpHash, verifyOtpAttempts: { lte: OTP_MAX_ATTEMPTS } }, data: { isVerified: true, verifyOtp: null, verifyOtpHash: null, verifyOtpAttempts: 0, verifyExpires: null } });
    if (!updatedRows.count) return res.status(400).json({ error: 'OTP буруу эсвэл дахин ашигласан байна' });
    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      include: { program: { select: { id: true, name: true, school: true, code: true } } },
    });
    const jti = crypto.randomUUID();
    await createSession(updated.id, req, jti);
    const token = sign(updated, jti);
    setAuthCookie(res, token);
    res.json({ ok: true, user: safe(updated) });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: safe(req.user) }));

router.post('/logout', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearer || req.cookies?.wa_token || null;
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (payload?.jti) await destroySessionByJti(payload.jti);
    }
  } catch {}
  clearAuthCookie(res);
  clearAdminChallenge(res);
  res.json({ ok: true });
});

const profileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(60).optional(),
    phone: z.string().max(20).nullable().optional(),
    programId: z.string().min(1).max(60).nullable().optional().or(z.literal('')),
    academicProgramId: z.string().min(1).max(60).nullable().optional().or(z.literal('')),
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

async function resolveAcademicProgramId({ programId, customProgram, school }) {
  // Шинэ AcademicProgram (бүртгэлийн салбар/хөтөлбөр) — шалгалтын Program-аас тусдаа
  if (programId) {
    const p = await prisma.academicProgram.findUnique({ where: { id: programId } });
    if (p) return p.id;
    // Fallback: хуучин Program ID байж магадгүй
    const old = await prisma.program.findUnique({ where: { id: programId } });
    if (old) return null;
    return null;
  }
  const name = customProgram?.trim();
  if (!name) return null;
  const sch = school?.trim() || null;
  const uni = 'МУИС';
  const existing = await prisma.academicProgram.findFirst({ where: { university: uni, school: sch, name } });
  if (existing) return existing.id;
  const created = await prisma.academicProgram.create({
    data: { university: uni, school: sch, name, order: 0 },
  });
  return created.id;
}
const passwordSchema = z.object({
  body: z.object({
    current: z.string().min(1, 'Одоогийн нууц үг шаардлагатай'),
    next: z.string().min(12, 'Шинэ нууц үг хамгийн багадаа 12 тэмдэгт').max(72),
  }),
});

router.put('/profile', requireAuth, validate(profileSchema), async (req, res, next) => {
  try {
    const { name, phone, programId, academicProgramId, customProgram, school } = req.body || {};
    const data = {};
    if (name?.trim()) data.name = name.trim();
    if (phone !== undefined) data.phone = phone?.trim() || null;
    // Шинэ AcademicProgram (бүртгэлийн салбар/хөтөлбөр) — шалгалтын Program-аас тусдаа
    const progId = academicProgramId || programId;
    if (progId !== undefined || customProgram !== undefined) {
      const finalAcademicId = await resolveAcademicProgramId({ programId: progId, customProgram, school });
      if (customProgram?.trim() && !finalAcademicId)
        return res.status(400).json({ error: 'Мэргэжил үүсгэж чадсангүй — дахин оролдоно уу' });
      data.academicProgramId = finalAcademicId;
      data.programId = null;
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: {
        program: { select: { id: true, name: true, school: true, code: true } },
        academicProgram: { select: { id: true, name: true, school: true, code: true, university: true } },
      },
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
    const passwordHash = await bcrypt.hash(newPass, 12);
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({ where: { id: u.id, passwordHash: u.passwordHash }, data: { passwordHash, adminMfaVerifiedAt: null } });
      if (!changed.count) throw Object.assign(new Error('Нууц үг өөрчлөгдсөн — дахин нэвтэрнэ үү'), { status: 409 });
      await tx.userSession.deleteMany({ where: { userId: u.id, ...(u.role !== 'ADMIN' && req.jti ? { NOT: { jti: req.jti } } : {}) } });
      await revokeAdminDevices(tx, u);
    });
    if (u.role === 'ADMIN') clearAuthCookie(res);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

function safe(u) {
  const { passwordHash, verifyOtp, verifyOtpHash, verifyOtpAttempts, adminMfaVerifiedAt, ...rest } = u;
  return rest;
}

return router;
}

export default createAuthRouter();
