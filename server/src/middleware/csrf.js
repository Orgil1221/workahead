import crypto from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

const cookieName = (suffix) => `${process.env.NODE_ENV === 'production' ? '__Host-' : ''}wa_csrf${suffix}`;
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/' });

export function clearCsrfCookies(res) {
  res.clearCookie(cookieName(''), options());
  res.clearCookie(cookieName('_session'), options());
  // Clear the pre-hardening cookie during rollout.
  res.clearCookie('x-csrf-token', { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production', path: '/' });
}

export function installCsrf(app) {
  const sessionCookie = cookieName('_session');
  const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => {
      const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
      if (!secret) throw new Error('CSRF_SECRET must be configured');
      return secret;
    },
    getSessionIdentifier: (req) => {
      const header = req.headers.authorization || '';
      return (header.startsWith('Bearer ') ? header.slice(7) : null)
        || req.cookies?.wa_token || req.cookies?.[sessionCookie] || 'missing-session';
    },
    cookieName: cookieName(''),
    cookieOptions: options(),
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  });
  app.get('/api/auth/csrf', (req, res) => {
    res.set('Cache-Control', 'no-store');
    // Give anonymous login/register requests their own browser binding too.
    if (!/^[a-f\d]{64}$/.test(req.cookies?.[sessionCookie] || '')) {
      const value = crypto.randomBytes(32).toString('hex');
      req.cookies[sessionCookie] = value;
      res.cookie(sessionCookie, value, options());
    }
    res.json({ csrfToken: generateCsrfToken(req, res) });
  });
  app.use((req, res, next) => {
    // This server-to-server endpoint verifies its provider HMAC instead.
    if (req.path === '/api/payments/webhook') return next();
    return doubleCsrfProtection(req, res, next);
  });
}
