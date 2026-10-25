import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { installCsrf } from './middleware/csrf.js';
import { validateProductionSecurity } from './config/security.js';
import { rateLimitFlexible } from './middleware/rateLimitFlexible.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import examRoutes from './routes/exams.js';
import attemptRoutes from './routes/attempts.js';
import bookmarkRoutes from './routes/bookmarks.js';
import flagRoutes from './routes/flags.js';
import notificationRoutes from './routes/notifications.js';
import paymentRoutes from './routes/payments.js';
import pushRoutes from './routes/push.js';
import usageRoutes from './routes/usage.js';
import chatRoutes from './routes/chat.js';
import adminUsageRoutes from './routes/admin/usage.js';
import adminCatalogRoutes from './routes/admin/catalog.js';
import adminStatsRoutes from './routes/admin/stats.js';
import adminUserRoutes from './routes/admin/users.js';
import adminImportRoutes from './routes/admin/import.js';
import adminPlanRoutes from './routes/admin/plans.js';
import adminSettingsRoutes from './routes/admin/settings.js';
import adminAuditRoutes from './routes/admin/audit.js';
import { auditAdminActions } from './middleware/adminAudit.js';
import { academicRouter, academicAdminRouter } from './routes/academic.js';

const app = express();
// Render terminates TLS and forwards one trusted proxy hop. Keep this narrow
// so client-supplied X-Forwarded-For values are not used as the source IP.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
validateProductionSecurity();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cookieParser());
// CORS — require explicit origin in production
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean) : null;
app.use(cors(corsOrigin ? { origin: corsOrigin, credentials: true } : { origin: true, credentials: true }));
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// Health before rate limit — keep-alive 01-06 sleep ping буюу UptimeRobot-д зориулсан хөнгөн endpoint
// monitor.yml (GitHub) + UptimeRobot хоёулаа эндээс шалгана
app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime(), time: new Date().toISOString(), ...(process.env.NODE_ENV !== 'production' && process.env.CHAT_LOCAL_DEMO === '1' ? { localChatDemo: true } : {}) }));
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// General rate limit — 200 req/min per IP; only the health routes above are exempt.
app.use('/api', rateLimitFlexible('general'));
app.use('/api', auditAdminActions);

installCsrf(app);

app.use('/api/auth', authRoutes);
app.use('/api', academicRouter);
app.use('/api', catalogRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin/audit', adminAuditRoutes);
app.use('/api/admin/usage', adminUsageRoutes);
app.use('/api/admin/catalog', adminCatalogRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/import', adminImportRoutes);
app.use('/api/admin/plans', adminPlanRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/academic-programs', academicAdminRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status >= 500 ? 'Серверийн алдаа' : (err.message || 'Серверийн алдаа'),
    ...(process.env.NODE_ENV === 'production' && status >= 500 ? {} : { code: err.code }),
  });
});

const port = process.env.PORT || 4000;
app.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`Work Ahead API → http://localhost:${port}`);
  Promise.all([import('./services/usage.js'), import('./db.js')]).then(([usage, database]) => {
    database.default.emailOtp.updateMany({ where: { otp: { not: null } }, data: { otp: null } })
      .then(() => database.default.user.updateMany({ where: { verifyOtp: { not: null } }, data: { verifyOtp: null } }))
      .catch((error) => console.error('Legacy plaintext OTP cleanup failed:', error.message));
    const cleanup = () => usage.pruneUsage(database.default).catch((error) => console.error('Usage retention:', error.message));
    setTimeout(cleanup, 30000);
    setInterval(cleanup, 24 * 60 * 60 * 1000);
  }).catch((error) => console.error('Usage retention:', error.message));
  // Expire stale PENDING every 5 min — prevents DoS via PENDING flood (C3)
  import('./jobs/expirePending.js').then(({ expireStalePending }) => {
    const ttl = Number(process.env.PENDING_TTL_MINUTES || 15);
    setInterval(() => expireStalePending(ttl), 5 * 60 * 1000);
    // Run once on startup after 30s
    setTimeout(() => expireStalePending(ttl), 30_000);
  }).catch(() => {});
});
