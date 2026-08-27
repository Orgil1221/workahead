import crypto from 'node:crypto';

const BASE_URL = process.env.BONUM_API_BASE_URL || 'https://testapi.bonum.mn';
const APP_SECRET = process.env.BONUM_APP_SECRET;
const TERMINAL_ID = process.env.BONUM_TERMINAL_ID;
const CHECKSUM_KEY = process.env.BONUM_CHECKSUM_KEY;

let tokenCache = { accessToken: null, refreshToken: null, expiresAt: 0 };

async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

export async function getToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60000)
    return tokenCache.accessToken;

  if (tokenCache.refreshToken && Date.now() < tokenCache.expiresAt + tokenCache.refreshTtl - 60000) {
    const r = await request('/bonum-gateway/ecommerce/auth/refresh', {
      headers: { Authorization: `Bearer ${tokenCache.refreshToken}` },
    });
    if (r.ok && r.data.accessToken) return store(r.data);
  }

  const r = await request('/bonum-gateway/ecommerce/auth/create', {
    headers: { Authorization: `AppSecret ${APP_SECRET}`, 'X-TERMINAL-ID': TERMINAL_ID },
  });
  if (!r.ok || !r.data.accessToken)
    throw Object.assign(new Error(`Bonum auth failed (${r.status})`), { status: 502 });
  return store(r.data);
}

function store(d) {
  const ttl = (d.expiresIn || 1800) * 1000;
  const refreshTtl = (d.refreshExpiresIn || 2000) * 1000;
  tokenCache = {
    accessToken: d.accessToken,
    refreshToken: d.refreshToken,
    expiresAt: Date.now() + ttl,
    refreshTtl,
  };
  return d.accessToken;
}

export async function createInvoice({ amount, transactionId, callbackUrl, expiresIn }) {
  const token = await getToken();
  const r = await request('/bonum-gateway/ecommerce/invoices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'mn',
    },
    body: {
      amount,
      callback: callbackUrl,
      transactionId,
      expiresIn: expiresIn ?? 3600,
      providers: ['QPAY', 'E_COMMERCE'],
    },
  });
  if (!r.ok || !r.data.followUpLink)
    throw Object.assign(new Error(`Bonum invoice failed (${r.status})`), {
      status: 502,
      detail: r.data,
    });
  return r.data; // { invoiceId, followUpLink }
}

export function verifyChecksum(rawBody, checksumHeader) {
  if (!CHECKSUM_KEY || !checksumHeader) return false;
  const hmac = crypto.createHmac('sha256', CHECKSUM_KEY);
  hmac.update(rawBody, 'utf8');
  const expected = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(checksumHeader));
  } catch {
    return false;
  }
}

export function isConfigured() {
  return Boolean(APP_SECRET && TERMINAL_ID);
}
