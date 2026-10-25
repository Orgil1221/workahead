import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { adminSessionIsValid } from '../services/adminMfa.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = req.cookies?.wa_token || null;
  const token = bearer || cookieToken;
  if (!token) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    // Хуучин token (jti-гүй) — шинэ session системд дахин нэвтрэх шаардлагатай
    if (!payload.jti) {
      return res.status(401).json({ error: 'Session шинэчлэгдсэн — дахин нэвтэрнэ үү', code: 'SESSION_EXPIRED' });
    }
    // Session шалгах — өөр төхөөрөмжөөс нэвтэрсэн бол хуучин jti устгагдсан байна
    const sess = await prisma.userSession.findUnique({ where: { jti: String(payload.jti) } });
    if (!sess || sess.userId !== payload.sub) {
      return res.status(401).json({ error: 'Өөр төхөөрөмжөөс нэвтэрсэн тул гарлаа', code: 'DEVICE_KICKED' });
    }
    if (sess.expiresAt && new Date(sess.expiresAt) < new Date()) {
      await prisma.userSession.deleteMany({ where: { jti: String(payload.jti) } }).catch(() => {});
      return res.status(401).json({ error: 'Session дууссан — дахин нэвтэрнэ үү', code: 'SESSION_EXPIRED' });
    }
    // lastActive шинэчлэх (хүлээлгүй, алдаа залгих)
    prisma.userSession.update({
      where: { jti: String(payload.jti) },
      data: { lastActive: new Date() },
    }).catch(() => {});
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        program: { select: { id: true, name: true, school: true, code: true } },
        academicProgram: { select: { id: true, name: true, school: true, code: true, university: true } },
      },
    });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Хэрэглэгч олдсонгүй эсвэл идэвхгүй байна' });
    if (user.role === 'ADMIN' && !(await adminSessionIsValid(prisma, user, payload.adminDeviceId))) {
      return res.status(401).json({ error: 'Админы баталгаажуулалт шаардлагатай — дахин нэвтэрнэ үү', code: 'ADMIN_MFA_REQUIRED' });
    }
    req.user = user;
    req.jti = String(payload.jti);
    req.deviceType = sess.deviceType;
    next();
  } catch {
    return res.status(401).json({ error: 'Токен хүчингүй' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Админ эрх шаардлагатай' });
  next();
}
