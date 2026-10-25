import crypto from 'node:crypto';
import prisma from '../db.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function auditAdminActions(req, res, next) {
  const path = String(req.originalUrl || '').split('?')[0];
  const sensitiveRead = req.method === 'GET' && /^\/api\/admin\/(users|audit)(\/|$)/.test(path);
  if (!MUTATING.has(req.method) && !sensitiveRead) return next();
  res.once('finish', () => {
    if (req.user?.role !== 'ADMIN') return;
    const action = String(req.originalUrl || '/api/admin/unknown').split('?')[0]
      .replace(/\/[A-Za-z0-9_-]{18,}(?=\/|$)/g, '/:id').slice(0, 180);
    const secret = process.env.JWT_SECRET || 'development-only';
    const ipHash = req.ip ? crypto.createHmac('sha256', secret).update(req.ip).digest('hex') : null;
    prisma.adminAuditLog.create({
      data: { adminId: req.user.id, action, method: req.method, statusCode: res.statusCode, ipHash },
    }).catch((error) => console.error('Admin audit write failed:', error.message));
  });
  next();
}
