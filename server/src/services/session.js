import prisma from '../db.js';

// Төхөөрөмжийн төрөл — client X-Device-Type илгээвэл тэргүүн ээлжинд авна,
// үгүй бол User-Agent-аар ялгана (Mobi/Android/iPhone → MOBILE, бусад → DESKTOP).
export function getDeviceType(req) {
  const h = String(req.headers?.['x-device-type'] || '').toUpperCase().trim();
  if (h === 'MOBILE' || h === 'DESKTOP') return h;
  const ua = String(req.headers?.['user-agent'] || '');
  if (/Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return 'MOBILE';
  return 'DESKTOP';
}

// Нэвтрэх бүрд дуудна — тухайн төрлийн хуучин session-ийг kick хийж шинээр үүсгэнэ.
// Ингэснээр 1 хэрэглэгч хамгийн ихдээ 1 DESKTOP + 1 MOBILE session-той.
// upsert ашиглана — зэрэг 2 login давхцсан ч race үүсэхгүй.
export async function createSession(userId, req, jti) {
  const deviceType = getDeviceType(req);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // JWT 7d-тэй адил
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 300) || null;
  const fwd = String(req.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
  const ip = String(fwd || req.ip || '').slice(0, 60) || null;
  // Хугацаа дууссан session-уудээ цэвэрлэ (opportunistic)
  prisma.userSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  await prisma.userSession.upsert({
    where: { userId_deviceType: { userId, deviceType } },
    update: { jti, userAgent, ip, expiresAt, lastActive: new Date() },
    create: { userId, deviceType, jti, userAgent, ip, expiresAt },
  });
  return deviceType;
}

export async function destroySessionByJti(jti) {
  if (!jti) return;
  await prisma.userSession.deleteMany({ where: { jti: String(jti) } }).catch(() => {});
}
