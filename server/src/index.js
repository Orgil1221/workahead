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

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cookieParser());
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : null;
app.use(cors(corsOrigin ? { origin: corsOrigin, credentials: true } : { credentials: true }));
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// General rate limit — 100 req/min per IP
app.use('/api', rateLimitFlexible('general'));

// CSRF protection (double submit) — GET/HEAD/OPTIONS ignored, webhook excluded
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-me',
  getSessionIdentifier: () => 'default',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'Lax',
    // Production (https) дээр secure cookie — local dev дээр false хэвээр
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] || req.headers['x-xsrf-token'],
});
app.get('/api/auth/csrf', (req, res) => res.json({ csrfToken: generateCsrfToken(req, res) }));
// Webhook uses HMAC, not CSRF — skip; login/register/logout need no CSRF before auth
app.use((req, res, next) => {
  if (req.path === '/api/payments/webhook' || req.path === '/api/auth/login' || req.path === '/api/auth/register' || req.path === '/api/auth/csrf' || req.path === '/api/auth/logout') return next();
  return doubleCsrfProtection(req, res, next);
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Серверийн алдаа', code: err.code });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Work Ahead API → http://localhost:${port}`));
