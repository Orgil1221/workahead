import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

// Never load .env or contact a production database/email provider in this suite.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.OTP_HASH_SECRET = crypto.randomBytes(32).toString('hex');
process.env.CSRF_SECRET = crypto.randomBytes(32).toString('hex');
process.env.ADMIN_OTP_RECIPIENT = 'private-security-mailbox@example.test';
process.env.RATE_LIMIT_DISABLED = '1';
delete process.env.REDIS_URL;
const run = promisify(execFile);
const PASSWORD = 'integration-test-password-123';
let db, pg, socket, http, base, mfaModule, databaseReady = false;
let deliveries = [];
let deliveryFailure = false;

before(async () => {
  console.info('Auth integration: preparing isolated database');
  const schema = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
  const cli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
  if (process.env.TEST_DATABASE_URL) {
    const target = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname) && target.pathname === '/workahead_security_test', 'Use only the dedicated local test database');
    process.env.DATABASE_URL = target.toString();
    await run(process.execPath, [cli, 'db', 'push', '--skip-generate'], { env: process.env, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  } else {
    pg = await PGlite.create();
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postgres';
    const { stdout } = await run(process.execPath, [cli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schema, '--script'], { env: process.env, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    await pg.exec(stdout);
    console.info('Auth integration: schema created');
    socket = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 1 });
    await socket.start();
    const address = socket.getServerConn();
    const match = address.match(/(?:127\.0\.0\.1|localhost):(\d+)/);
    assert.ok(match && Number(match[1]) > 0, 'PGlite must bind an ephemeral loopback port');
    process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${match[1]}/postgres?connection_limit=1&sslmode=disable`;
  }
  db = (await import('../src/db.js')).default;
  await db.$connect();
  databaseReady = true;
  console.info('Auth integration: Prisma connected');
  const { createAuthRouter } = await import('../src/routes/auth.js');
  const { requireAuth, requireAdmin } = await import('../src/middleware/auth.js');
  const { rateLimitFlexible } = await import('../src/middleware/rateLimitFlexible.js');
  const { installCsrf } = await import('../src/middleware/csrf.js');
  const adminUsers = (await import('../src/routes/admin/users.js')).default;
  mfaModule = await import('../src/services/adminMfa.js');
  const app = express();
  app.use(express.json(), cookieParser());
  installCsrf(app);
  app.use('/api/auth', createAuthRouter({ sendOtpEmail: async (to, otp, purpose) => {
    if (deliveryFailure) throw new Error('simulated mail outage');
    deliveries.push({ to, otp, purpose });
    return true;
  } }));
  app.use('/api/admin/users', adminUsers);
  app.get('/protected', requireAuth, requireAdmin, (_req, res) => res.json({ ok: true }));
  app.post('/limited', rateLimitFlexible('auth'), (_req, res) => res.json({ ok: true }));
  app.post('/limited-account', rateLimitFlexible('loginAccount'), (_req, res) => res.json({ ok: true }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message, code: error.code }));
  http = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => http.once('listening', resolve));
  base = `http://127.0.0.1:${http.address().port}`;
  console.info('Auth integration: HTTP fixture ready');
}, { timeout: 120000 });

after(async () => {
  if (http) { http.closeAllConnections(); await new Promise((resolve) => http.close(resolve)); }
  if (db && databaseReady) {
    await db.user.deleteMany({ where: { email: { endsWith: '@test.invalid' } } });
    await db.emailOtp.deleteMany({ where: { email: { endsWith: '@test.invalid' } } });
  }
  if (db) await db.$disconnect();
  if (socket) await socket.stop();
  if (pg) await pg.close();
}, { timeout: 20000 });

function browser(initial = {}) {
  const cookies = new Map(Object.entries(initial));
  return {
    cookies,
    async request(path, body, { method = body === undefined ? 'GET' : 'POST', headers = {}, csrf = true } = {}) {
      if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const token = await this.request('/api/auth/csrf');
        assert.equal(token.status, 200);
        headers = { 'x-csrf-token': token.data.csrfToken, ...headers };
      }
      const response = await fetch(base + path, { method, headers: {
        'content-type': 'application/json', cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...headers,
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
      const setCookies = response.headers.getSetCookie();
      for (const item of setCookies) {
        const first = item.split(';')[0]; const split = first.indexOf('=');
        if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(item)) cookies.delete(first.slice(0, split));
        else cookies.set(first.slice(0, split), first.slice(split + 1));
      }
      return { status: response.status, data: await response.json(), setCookies };
    },
  };
}
async function user(role = 'ADMIN') {
  return db.user.create({ data: { email: `${crypto.randomUUID()}@test.invalid`, name: 'Integration fixture', role, isVerified: true, passwordHash: await bcrypt.hash(PASSWORD, 4) } });
}
async function begin(u, b) {
  const before = deliveries.length;
  const result = await b.request('/api/auth/login', { email: u.email, password: PASSWORD });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.mfaRequired, true);
  assert.deepEqual(Object.keys(result.data).sort(), ['expiresAt', 'mfaRequired']);
  assert.equal(deliveries.length, before + 1);
  assert.equal(deliveries.at(-1).to, process.env.ADMIN_OTP_RECIPIENT);
  return { result, otp: deliveries.at(-1).otp };
}
async function verified(u = null, b = browser()) {
  u ||= await user();
  const { otp } = await begin(u, b);
  const result = await b.request('/api/auth/verify-admin-login', { email: u.email, otp });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return { u, b, result, otp };
}
async function ageSends(u, seconds = 61) {
  await db.adminAuthChallenge.updateMany({ where: { userId: u.id }, data: { createdAt: new Date(Date.now() - seconds * 1000) } });
}

test('password + browser-bound OTP issues a 24h admin session and hides secrets', async () => {
  const u = await user(); const b = browser();
  const { result: start, otp } = await begin(u, b);
  assert.equal(b.cookies.has('wa_token'), false);
  assert.match(start.setCookies[0], /HttpOnly/);
  assert.match(start.setCookies[0], /SameSite=Strict/);
  const row = await db.adminAuthChallenge.findFirst({ where: { userId: u.id } });
  assert.notEqual(row.otpHash, otp);
  assert.equal(row.expiresAt - row.createdAt, 10 * 60 * 1000);
  const done = await b.request('/api/auth/verify-admin-login', { email: u.email, otp });
  assert.equal(done.status, 200);
  for (const field of ['token', 'passwordHash', 'verifyOtp', 'verifyOtpHash', 'adminMfaVerifiedAt']) {
    assert.equal(field in done.data, false); assert.equal(field in done.data.user, false);
  }
  assert.equal((await b.request('/protected')).status, 200);
  const device = await db.adminTrustedDevice.findFirst({ where: { userId: u.id } });
  assert.equal(device.expiresAt - device.createdAt, 24 * 60 * 60 * 1000);
  const session = await db.userSession.findFirst({ where: { userId: u.id } });
  assert.equal(+session.expiresAt, +device.expiresAt);
  const claims = jwt.decode(b.cookies.get('wa_token'));
  assert.equal(claims.adminDeviceId, device.id);
  assert.ok(claims.exp * 1000 <= +device.expiresAt);
});

test('retrying a pending admin challenge does not disclose its delivery address', async () => {
  const u = await user(); const b = browser();
  const { result: first } = await begin(u, b);
  const count = deliveries.length;
  const retry = await b.request('/api/auth/login', { email: u.email, password: PASSWORD });
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.data, first.data);
  assert.equal(deliveries.length, count);
  assert.equal(JSON.stringify(retry.data).includes(process.env.ADMIN_OTP_RECIPIENT), false);
});

test('password recovery hides admin routing for admin, student and nonexistent accounts', async () => {
  const admin = await user(); const student = await user('STUDENT');
  for (const [email, recipient] of [
    [admin.email, process.env.ADMIN_OTP_RECIPIENT],
    [student.email, student.email],
    [`missing-${crypto.randomUUID()}@test.invalid`, null],
  ]) {
    const count = deliveries.length;
    const response = await browser().request('/api/auth/forgot-password', { email });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data, { ok: true });
    assert.equal(deliveries.length, count + (recipient ? 1 : 0));
    if (recipient) assert.equal(deliveries.at(-1).to, recipient);
  }
});

test('same browser reuses fixed trust; another browser and a legacy account timestamp cannot bypass OTP', async () => {
  const { u, b } = await verified();
  const device = await db.adminTrustedDevice.findFirst({ where: { userId: u.id } });
  const count = deliveries.length;
  await b.request('/api/auth/logout', {});
  assert.equal((await b.request('/api/auth/login', { email: u.email, password: PASSWORD })).status, 200);
  assert.equal(deliveries.length, count);
  assert.equal(+(await db.adminTrustedDevice.findUnique({ where: { id: device.id } })).expiresAt, +device.expiresAt);
  await db.user.update({ where: { id: u.id }, data: { adminMfaVerifiedAt: new Date() } });
  await ageSends(u);
  const other = browser(); await begin(u, other);
  assert.equal(other.cookies.has('wa_token'), false);
  assert.equal((await other.request('/protected')).status, 401);
});

test('OTP cannot be used without its original browser or against another account', async () => {
  const u = await user(); const b = browser(); const { otp } = await begin(u, b);
  assert.equal((await browser().request('/api/auth/verify-admin-login', { email: u.email, otp })).status, 400);
  const other = await user();
  assert.equal((await b.request('/api/auth/verify-admin-login', { email: other.email, otp })).status, 400);
  assert.equal((await b.request('/api/auth/verify-admin-login', { email: u.email, otp })).status, 200);
});

test('expired codes fail and can be replaced after cooldown without a 24h lockout', async () => {
  const u = await user(); const b = browser(); const { otp } = await begin(u, b);
  await db.adminAuthChallenge.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await b.request('/api/auth/verify-admin-login', { email: u.email, otp })).status, 400);
  await ageSends(u);
  const { otp: replacement } = await begin(u, b);
  assert.equal((await b.request('/api/auth/verify-admin-login', { email: u.email, otp: replacement })).status, 200);
});

test('five incorrect entries invalidate the challenge, including a later correct entry', async () => {
  const u = await user(); const b = browser(); const { otp } = await begin(u, b);
  const wrong = otp === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await b.request('/api/auth/verify-admin-login', { email: u.email, otp: wrong })).status, 400);
  assert.equal((await b.request('/api/auth/verify-admin-login', { email: u.email, otp })).status, 400);
  const challenge = await db.adminAuthChallenge.findFirst({ where: { userId: u.id } });
  assert.equal(challenge.attempts, 5); assert.ok(challenge.consumedAt);
});

test('concurrent correct submissions consume the OTP exactly once', async () => {
  const u = await user(); const b = browser(); const { otp } = await begin(u, b);
  const clone = browser(Object.fromEntries(b.cookies));
  const results = await Promise.all([b, clone].map((client) => client.request('/api/auth/verify-admin-login', { email: u.email, otp })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  assert.equal(await db.adminTrustedDevice.count({ where: { userId: u.id } }), 1);
});

test('expired/revoked trust rejects a live admin session and a forged device cookie grants nothing', async () => {
  const { u, b } = await verified();
  await db.adminTrustedDevice.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await b.request('/protected')).status, 401);
  await ageSends(u);
  await begin(u, browser({ wa_admin_device: crypto.randomBytes(32).toString('base64url') }));
});

test('old seven-day admin tokens without device MFA proof are rejected', async () => {
  const u = await user(); const jti = crypto.randomUUID();
  await db.userSession.create({ data: { userId: u.id, deviceType: 'DESKTOP', jti, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  const oldToken = jwt.sign({ sub: u.id, role: 'ADMIN', jti }, process.env.JWT_SECRET, { expiresIn: '7d' });
  assert.equal((await browser({ wa_token: oldToken }).request('/protected')).status, 401);
});

test('password changes revoke remembered browsers, pending challenges and admin sessions', async () => {
  const { u, b } = await verified();
  await ageSends(u); await begin(u, browser());
  assert.equal((await b.request('/api/auth/password', { current: PASSWORD, next: PASSWORD + '-new' })).status, 200);
  assert.equal(await db.adminTrustedDevice.count({ where: { userId: u.id } }), 0);
  assert.equal(await db.adminAuthChallenge.count({ where: { userId: u.id } }), 0);
  assert.equal(await db.userSession.count({ where: { userId: u.id } }), 0);
  const result = await b.request('/api/auth/login', { email: u.email, password: PASSWORD + '-new' });
  assert.equal(result.data.mfaRequired, true);
});

test('admin password recovery goes to the fixed mailbox, consumes the code once and revokes all trust', async () => {
  const { u, b } = await verified();
  const recovery = browser();
  assert.equal((await recovery.request('/api/auth/forgot-password', { email: u.email })).status, 200);
  const mail = deliveries.at(-1);
  assert.equal(mail.to, process.env.ADMIN_OTP_RECIPIENT);
  assert.equal(mail.purpose, 'reset');
  const payload = { email: u.email, otp: mail.otp, newPassword: PASSWORD + '-reset' };
  const results = await Promise.all([recovery, browser()].map((client) => client.request('/api/auth/reset-password', payload)));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  assert.equal(await db.adminTrustedDevice.count({ where: { userId: u.id } }), 0);
  assert.equal(await db.adminAuthChallenge.count({ where: { userId: u.id } }), 0);
  assert.equal(await db.userSession.count({ where: { userId: u.id } }), 0);
  assert.equal((await b.request('/protected')).status, 401);
  const fresh = await recovery.request('/api/auth/login', { email: u.email, password: payload.newPassword });
  assert.equal(fresh.data.mfaRequired, true);
});

test('student login still works and never grants access to admin endpoints', async () => {
  const u = await user('STUDENT'); const b = browser(); const before = deliveries.length;
  const login = await b.request('/api/auth/login', { email: u.email, password: PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.data.mfaRequired, undefined);
  assert.equal(login.data.token, undefined);
  assert.equal(deliveries.length, before);
  assert.equal((await b.request('/api/auth/me')).status, 200);
  assert.equal((await b.request('/api/admin/users')).status, 403);
  assert.equal((await b.request('/protected')).status, 403);
});

test('CSRF protects login, logout and admin seed; tokens cannot cross browsers or login sessions', async () => {
  const u = await user(); const b = browser();
  assert.equal((await b.request('/api/auth/login', { email: u.email, password: PASSWORD }, { csrf: false })).status, 403);
  const anonymous = await b.request('/api/auth/csrf');
  const copiedToken = { 'x-csrf-token': anonymous.data.csrfToken };
  assert.equal((await browser().request('/api/auth/login', { email: u.email, password: PASSWORD }, { csrf: false, headers: copiedToken })).status, 403);
  await verified(u, b);
  assert.equal((await b.request('/api/auth/logout', {}, { csrf: false, headers: copiedToken })).status, 403);
  assert.equal((await b.request('/api/auth/logout', {}, { csrf: false })).status, 403);
  assert.equal((await b.request('/api/admin/academic-programs/seed', {}, { csrf: false })).status, 403);
  assert.equal((await b.request('/protected')).status, 200);
  assert.equal((await b.request('/api/auth/logout', {})).status, 200);
  assert.equal((await b.request('/protected')).status, 401);
});

test('the real client API refreshes CSRF after admin login and successfully logs out', async () => {
  const u = await user(); const cookies = new Map(); const responses = [];
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const storage = new Map();
  globalThis.window = { location: { pathname: '/login', href: '/login' } };
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  // Node fetch lacks browser cookies. Keep a browser-like jar, while exercising
  // the shipped client's headers, CSRF cache/refresh and mutation retry policy.
  globalThis.fetch = async (path, options = {}) => {
    const response = await originalFetch(base + path, { ...options, headers: {
      ...options.headers, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
    } });
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(';')[0]; const split = first.indexOf('=');
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(cookie)) cookies.delete(first.slice(0, split));
      else cookies.set(first.slice(0, split), first.slice(split + 1));
    }
    responses.push({ path, status: response.status });
    return response;
  };
  try {
    const { api } = await import('../../client/src/api/client.js');
    assert.equal((await api('/auth/login', { method: 'POST', body: { email: u.email, password: PASSWORD } })).mfaRequired, true);
    assert.equal((await api('/auth/verify-admin-login', { method: 'POST', body: { email: u.email, otp: deliveries.at(-1).otp } })).user.id, u.id);
    const profile = await api('/auth/profile', { method: 'PUT', body: { name: 'Browser fixture updated' } });
    assert.equal(profile.user.name, 'Browser fixture updated');
    assert.deepEqual(responses.filter((r) => r.path === '/api/auth/profile').map((r) => r.status), [403, 200]);
    assert.equal((await api('/auth/logout', { method: 'POST' })).ok, true);
    assert.equal(cookies.has('wa_token'), false);
    assert.equal(await db.userSession.count({ where: { userId: u.id } }), 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
  }
});

test('deactivation/restoration and role changes revoke previous admin trust', async () => {
  const owner = await verified(); const target = await verified();
  assert.equal((await owner.b.request(`/api/admin/users/${target.u.id}`, {}, { method: 'DELETE' })).status, 200);
  assert.equal((await target.b.request('/protected')).status, 401);
  assert.equal(await db.adminTrustedDevice.count({ where: { userId: target.u.id } }), 0);
  assert.equal((await owner.b.request(`/api/admin/users/${target.u.id}`, { isActive: true }, { method: 'PUT' })).status, 200);
  await verified(target.u, target.b);
  assert.equal((await owner.b.request(`/api/admin/users/${target.u.id}`, { role: 'STUDENT' }, { method: 'PUT' })).status, 200);
  assert.equal(await db.adminTrustedDevice.count({ where: { userId: target.u.id } }), 0);
  assert.equal((await target.b.request('/protected')).status, 401);
});

test('email verification cannot issue an admin session without password + admin MFA', async () => {
  const u = await user();
  const { otpDigest } = await import('../src/services/otp.js');
  await db.user.update({ where: { id: u.id }, data: { isVerified: false, verifyOtpHash: otpDigest(u.email, '123456'), verifyExpires: new Date(Date.now() + 600000) } });
  const b = browser();
  assert.equal((await b.request('/api/auth/verify-otp', { email: u.email, otp: '123456' })).status, 403);
  assert.equal(b.cookies.has('wa_token'), false);
});

test('unsigned logout payload cannot revoke another admin session', async () => {
  const { u, b } = await verified();
  const session = await db.userSession.findFirst({ where: { userId: u.id } });
  const forged = jwt.sign({ sub: u.id, jti: session.jti }, '', { algorithm: 'none' });
  await browser({ wa_token: forged }).request('/api/auth/logout', {});
  assert.equal((await b.request('/protected')).status, 200);
});

test('mail failures fail closed and retain issuance limits', async () => {
  const u = await user(); const b = browser(); deliveryFailure = true;
  try {
    assert.equal((await b.request('/api/auth/login', { email: u.email, password: PASSWORD })).status, 503);
    assert.equal(b.cookies.has('wa_token'), false);
    assert.equal(b.cookies.has('wa_admin_device'), false);
    assert.ok((await db.adminAuthChallenge.findFirst({ where: { userId: u.id } })).consumedAt);
  } finally { deliveryFailure = false; }
  assert.equal((await b.request('/api/auth/login', { email: u.email, password: PASSWORD })).status, 429);
});

test('database-enforced delivery budget survives new browsers and limits mail to five per 15min', async () => {
  const u = await user();
  for (let i = 0; i < 5; i++) { await begin(u, browser()); await ageSends(u); }
  assert.equal((await browser().request('/api/auth/login', { email: u.email, password: PASSWORD })).status, 429);
});

test('production remembered-browser cookies are Secure, HttpOnly and host-only', async () => {
  const u = await user(); const cookies = []; let otp;
  process.env.NODE_ENV = 'production';
  try {
    const mfa = mfaModule.createAdminMfa({ db, sendEmail: async (_to, code) => { otp = code; return true; } });
    await mfa.begin(u, { cookies: {} }, { cookie: (...args) => cookies.push(args) });
    assert.equal(cookies[0][0], '__Host-wa_admin_challenge');
    assert.equal(cookies[0][2].secure, true);
    assert.equal(cookies[0][2].httpOnly, true);
    assert.equal(cookies[0][2].sameSite, 'Strict');
    assert.equal(cookies[0][2].path, '/'); assert.equal(cookies[0][2].domain, undefined);
    await mfa.verify(u.email, otp, { cookies: { [cookies[0][0]]: cookies[0][1] } }, {
      cookie: (...args) => cookies.push(args), clearCookie: () => {},
    });
    assert.equal(cookies[1][0], '__Host-wa_admin_device');
    assert.equal(cookies[1][2].secure, true);
    assert.equal(cookies[1][2].httpOnly, true);
    assert.equal(cookies[1][2].sameSite, 'Strict');
    assert.equal(cookies[1][2].path, '/'); assert.equal(cookies[1][2].domain, undefined);
    assert.equal(cookies[1][2].maxAge, 86400000);
  } finally { process.env.NODE_ENV = 'test'; }
});

test('keep-alive User-Agent and spoofed forwarded IP do not bypass production rate limiting', async () => {
  process.env.NODE_ENV = 'production'; process.env.RATE_LIMIT_DISABLED = '0';
  try {
    const b = browser(); let last;
    for (let i = 0; i < 21; i++) last = await b.request('/limited', {}, { headers: { 'user-agent': 'keep-alive', 'x-forwarded-for': `203.0.113.${i}` } });
    assert.equal(last.status, 429);
  } finally { process.env.NODE_ENV = 'test'; process.env.RATE_LIMIT_DISABLED = '1'; }
});

test('account rate limit shares a budget across case, whitespace and changing forwarded IP headers', async () => {
  process.env.NODE_ENV = 'production'; process.env.RATE_LIMIT_DISABLED = '0';
  try {
    const b = browser(); let last;
    for (let i = 0; i < 11; i++) {
      const email = i % 2 ? '  TestAccount@Example.invalid  ' : 'testaccount@example.invalid';
      last = await b.request('/limited-account', { email }, { headers: { 'x-forwarded-for': `203.0.113.${i}` } });
    }
    assert.equal(last.status, 429);
    assert.equal((await b.request('/limited-account', { email: 'another-account@example.invalid' })).status, 200);
  } finally { process.env.NODE_ENV = 'test'; process.env.RATE_LIMIT_DISABLED = '1'; }
});
