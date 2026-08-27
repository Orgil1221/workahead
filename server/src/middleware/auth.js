import jwt from 'jsonwebtoken';
import prisma from '../db.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = req.cookies?.wa_token || null;
  const token = bearer || cookieToken;
  if (!token) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { program: { select: { id: true, name: true, school: true, code: true } } },
    });
    if (!user) return res.status(401).json({ error: 'Хэрэглэгч олдсонгүй' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Токен хүчингүй' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Админ эрх шаардлагатай' });
  next();
}
