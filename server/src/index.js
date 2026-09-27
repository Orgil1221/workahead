import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import { rateLimitFlexible } from './middleware/rateLimitFlexible.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import examRoutes from './routes/exams.js';
import attemptRoutes from './routes/attempts.js';
import bookmarkRoutes from './routes/bookmarks.js';
import flagRoutes from './routes/flags.js';
import notificationRoutes from './routes/notifications.js';
import paymentRoutes from './routes/payments.js';
import adminCatalogRoutes from './routes/admin/catalog.js';
import adminStatsRoutes from './routes/admin/stats.js';
import adminUserRoutes from './routes/admin/users.js';
import adminImportRoutes from './routes/admin/import.js';
import adminPlanRoutes from './routes/admin/plans.js';
import adminSettingsRoutes from './routes/admin/settings.js';
import { academicRouter, academicAdminRouter } from './routes/academic.js';

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cookieParser());
// CORS — require explicit origin in production
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean) : null;
if (!corsOrigin && process.env.NODE_ENV === 'production') {
  console.warn('CORS_ORIGIN not set — default allow is permissive');
}
app.use(cors(corsOrigin ? { origin: corsOrigin, credentials: true } : { origin: true, credentials: true }));
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// Health before rate limit — keep-alive 01-06 sleep ping буюу UptimeRobot-д зориулсан хөнгөн endpoint
app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// General rate limit — 200 req/min per IP (keep-alive exempt inside middleware)
app.use('/api', rateLimitFlexible('general'));

// CSRF protection (double submit) — GET/HEAD/OPTIONS ignored, webhook excluded
if (!process.env.CSRF_SECRET && !process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: CSRF_SECRET/JWT_SECRET missing in production');
}
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-me',
  getSessionIdentifier: (req) => req.user?.id || req.ip || 'default',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] || req.headers['x-xsrf-token'],
});
app.get('/api/auth/csrf', (req, res) => res.json({ csrfToken: generateCsrfToken(req, res) }));
// Webhook uses HMAC, not CSRF — skip; login/register/logout/otp/seed need no CSRF before auth (seed is admin JWT only)
app.use((req, res, next) => {
  if (req.path === '/api/payments/webhook' || req.path === '/api/auth/login' || req.path === '/api/auth/register' || req.path === '/api/auth/csrf' || req.path === '/api/auth/logout' || req.path === '/api/auth/send-otp' || req.path === '/api/auth/verify-otp' || req.path === '/api/auth/send-register-otp' || req.path === '/api/admin/academic-programs/seed') return next();
  return doubleCsrfProtection(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api', academicRouter);
app.use('/api', catalogRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/catalog', adminCatalogRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/import', adminImportRoutes);
app.use('/api/admin/plans', adminPlanRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/academic-programs', academicAdminRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Серверийн алдаа', code: err.code });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Work Ahead API → http://localhost:${port}`);
  // Expire stale PENDING every 5 min — prevents DoS via PENDING flood (C3)
  import('./jobs/expirePending.js').then(({ expireStalePending }) => {
    const ttl = Number(process.env.PENDING_TTL_MINUTES || 15);
    setInterval(() => expireStalePending(ttl), 5 * 60 * 1000);
    // Run once on startup after 30s
    setTimeout(() => expireStalePending(ttl), 30_000);
  }).catch(() => {});
});
