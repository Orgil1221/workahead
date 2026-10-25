import crypto from 'node:crypto';
import { generateOtp } from './email.js';
import { otpDigest, otpMatches } from './otp.js';

export const ADMIN_OTP_RECIPIENT = 'L.monhorgil2007@gmail.com';
export const ADMIN_CODE_TTL_MS = 10 * 60 * 1000;
export const ADMIN_TRUST_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_WAIT_MS = 60 * 1000;
const SEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS = 5;

export function adminCookieName(kind) {
  return `${process.env.NODE_ENV === 'production' ? '__Host-' : ''}wa_admin_${kind}`;
}
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/' });
const token = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (value) => typeof value === 'string' && /^[\w-]{43}$/.test(value)
  ? crypto.createHash('sha256').update(value).digest('hex') : null;
const credentials = (user) => otpDigest(`admin-credentials:${user.id}`, user.passwordHash);
const challengeScope = (userId, tokenHash) => `admin-login:${userId}:${tokenHash}`;
const validAdmin = (user) => user?.role === 'ADMIN' && user.isActive;
const failure = (message, status = 400, code = 'ADMIN_MFA_INVALID') => Object.assign(new Error(message), { status, code });
const invalidCode = () => failure('Код хүчингүй эсвэл хугацаа дууссан. Нууц үгээрээ дахин нэвтэрнэ үү.');

export function clearAdminChallenge(res) {
  res.clearCookie(adminCookieName('challenge'), cookieOptions());
}

export async function revokeAdminDevices(db, user) {
  await db.adminTrustedDevice.deleteMany({ where: { userId: user.id } });
  await db.adminAuthChallenge.deleteMany({ where: { userId: user.id } });
  await db.adminLoginOtp.deleteMany({ where: { email: user.email } });
}

// Used on every admin API request, including sessions issued before this rollout.
export async function adminSessionIsValid(db, user, deviceId, now = new Date()) {
  if (!validAdmin(user) || typeof deviceId !== 'string') return false;
  const device = await db.adminTrustedDevice.findUnique({ where: { id: deviceId } });
  return Boolean(device && device.userId === user.id && device.expiresAt > now && device.credentialHash === credentials(user));
}

export function createAdminMfa({ db, sendEmail, now = () => new Date() }) {
  async function trustedDevice(user, req) {
    const tokenHash = hashToken(req.cookies?.[adminCookieName('device')]);
    if (!validAdmin(user) || !tokenHash) return null;
    const device = await db.adminTrustedDevice.findUnique({ where: { tokenHash } });
    if (!device || device.userId !== user.id || device.expiresAt <= now() || device.credentialHash !== credentials(user)) return null;
    return device;
  }

  async function begin(user, req, res) {
    const trusted = await trustedDevice(user, req);
    if (trusted) return { device: trusted };
    const at = now();
    const previousHash = hashToken(req.cookies?.[adminCookieName('challenge')]);
    if (previousHash) {
      const previous = await db.adminAuthChallenge.findUnique({ where: { tokenHash: previousHash } });
      if (previous && previous.userId === user.id && !previous.consumedAt && previous.attempts < MAX_ATTEMPTS
        && previous.expiresAt > at && previous.credentialHash === credentials(user)) {
        return { mfaRequired: true, email: ADMIN_OTP_RECIPIENT, expiresAt: previous.expiresAt };
      }
    }
    const browserToken = token();
    const tokenHash = hashToken(browserToken);
    const otp = generateOtp();
    const expiresAt = new Date(at.getTime() + ADMIN_CODE_TTL_MS);
    await db.$transaction(async (tx) => {
      // Serialize issuance per account across processes; no in-memory-only send cap.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!validAdmin(current) || credentials(current) !== credentials(user)) throw invalidCode();
      await tx.adminAuthChallenge.deleteMany({ where: {
        userId: user.id, expiresAt: { lte: at }, createdAt: { lte: new Date(at.getTime() - SEND_WINDOW_MS) },
      } });
      await tx.adminTrustedDevice.deleteMany({ where: { userId: user.id, expiresAt: { lte: at } } });
      const recent = await tx.adminAuthChallenge.findMany({
        where: { userId: user.id, createdAt: { gt: new Date(at.getTime() - SEND_WINDOW_MS) } },
        orderBy: { createdAt: 'desc' }, take: MAX_SENDS,
      });
      if (recent.length >= MAX_SENDS || (recent[0] && at - recent[0].createdAt < RESEND_WAIT_MS)) {
        throw failure('Код саяхан илгээгдсэн. Түр хүлээгээд дахин нэвтэрнэ үү.', 429, 'ADMIN_MFA_SEND_LIMIT');
      }
      await tx.adminAuthChallenge.create({ data: {
        tokenHash, userId: user.id, otpHash: otpDigest(challengeScope(user.id, tokenHash), otp),
        credentialHash: credentials(user), expiresAt, createdAt: at,
      } });
    });
    try {
      if (await sendEmail(ADMIN_OTP_RECIPIENT, otp, 'admin-login') !== true) throw new Error('OTP delivery failed');
    } catch {
      // Retain the timestamp for throttling even if delivery fails.
      await db.adminAuthChallenge.update({ where: { tokenHash }, data: { consumedAt: at } });
      throw failure('Баталгаажуулах код илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу.', 503, 'ADMIN_MFA_DELIVERY');
    }
    res.cookie(adminCookieName('challenge'), browserToken, { ...cookieOptions(), maxAge: ADMIN_CODE_TTL_MS });
    return { mfaRequired: true, email: ADMIN_OTP_RECIPIENT, expiresAt };
  }

  async function verify(email, otp, req, res) {
    const tokenHash = hashToken(req.cookies?.[adminCookieName('challenge')]);
    if (!tokenHash) throw invalidCode();
    const at = now();
    const browserToken = token();
    const result = await db.$transaction(async (tx) => {
      const owner = await tx.adminAuthChallenge.findUnique({ where: { tokenHash }, select: { userId: true } });
      if (!owner) return null;
      // Use the same user -> challenge lock order as password/role revocation.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${owner.userId} FOR UPDATE`;
      // The challenge lock makes concurrent correct submissions single-use.
      await tx.$queryRaw`SELECT "tokenHash" FROM "AdminAuthChallenge" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      const challenge = await tx.adminAuthChallenge.findUnique({ where: { tokenHash }, include: { user: true } });
      const user = challenge?.user;
      if (!challenge || !validAdmin(user) || user.email !== email || challenge.consumedAt
        || challenge.attempts >= MAX_ATTEMPTS || challenge.expiresAt <= at || challenge.credentialHash !== credentials(user)) return null;
      const matches = otpMatches(challengeScope(user.id, tokenHash), otp, challenge.otpHash);
      await tx.adminAuthChallenge.update({ where: { tokenHash }, data: {
        attempts: { increment: 1 }, ...(matches || challenge.attempts + 1 >= MAX_ATTEMPTS ? { consumedAt: at } : {}),
      } });
      // Return, rather than throw, so failed-attempt increments commit.
      if (!matches) return null;
      const device = await tx.adminTrustedDevice.create({ data: {
        tokenHash: hashToken(browserToken), userId: user.id, credentialHash: credentials(user),
        expiresAt: new Date(at.getTime() + ADMIN_TRUST_TTL_MS), createdAt: at,
      } });
      return { user, device };
    });
    if (!result) throw invalidCode();
    res.cookie(adminCookieName('device'), browserToken, { ...cookieOptions(), maxAge: ADMIN_TRUST_TTL_MS });
    clearAdminChallenge(res);
    return result;
  }

  return { begin, verify };
}
