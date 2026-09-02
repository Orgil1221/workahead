const BASE = '/api';
let csrfToken = null;

// ── helpers ──
const DEFAULT_TIMEOUT = 12000; // 12s — Render cold start ~30-50s, retried
const RETRY_COUNT = 2; // total 3 attempts

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, opts = {}, timeout = DEFAULT_TIMEOUT) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  // merge external signal if provided
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  // retry csrf fetch with short timeout — don't block POST forever
  for (let i = 0; i <= 1; i++) {
    try {
      const r = await fetchWithTimeout(BASE + '/auth/csrf', { credentials: 'include' }, 8000);
      const d = await r.json().catch(() => ({}));
      if (d.csrfToken) {
        csrfToken = d.csrfToken;
        return csrfToken;
      }
      return null;
    } catch {
      if (i === 1) return null;
      await sleep(600);
    }
  }
  return null;
}

// warmup — fire-and-forget on app mount, retries to wake Render free
let warmupPromise = null;
export function warmup() {
  if (warmupPromise) return warmupPromise;
  warmupPromise = (async () => {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetchWithTimeout(BASE + '/health', { credentials: 'include' }, 10000);
        if (r.ok) return true;
      } catch {}
      if (i < 3) await sleep(1200 * (i + 1));
    }
    return false;
  })().finally(() => {
    // allow re-warm after 30s if needed
    setTimeout(() => { warmupPromise = null; }, 30000);
  });
  return warmupPromise;
}

export async function api(path, { method = 'GET', body, formData } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      const headers = {};
      const token = localStorage.getItem('wa_token');
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body) headers['Content-Type'] = 'application/json';
      // CSRF for state-changing requests (login/register excluded server-side)
      if (method !== 'GET' && method !== 'HEAD') {
        const csrf = await getCsrfToken();
        if (csrf) headers['x-csrf-token'] = csrf;
      }

      // longer timeout on retries — cold start needs it
      const timeout = attempt === 0 ? DEFAULT_TIMEOUT : 15000;
      const res = await fetchWithTimeout(BASE + path, {
        method,
        headers,
        body: formData ? formData : body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      }, timeout);

      // retry on Render 502/503/504 waking up
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        const e = new Error(`Сервер асч байна (${res.status}) — дахин оролдож байна...`);
        e.retryable = true;
        throw e;
      }

      if (res.status === 401) {
        localStorage.removeItem('wa_token');
        localStorage.removeItem('wa_user');
        // don't redirect during warmup health check
        if (path !== '/health' && path !== '/auth/csrf') window.location.href = '/login';
        throw new Error('Нэвтрэх шаардлагатай');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = new Error(data.error || `Алдаа (${res.status})`);
        // 5xx retryable
        if (res.status >= 500) e.retryable = true;
        throw e;
      }
      return data;
    } catch (e) {
      lastErr = e;
      const isAbort = e.name === 'AbortError';
      const isNetwork = e.message === 'Failed to fetch' || isAbort;
      const retryable = e.retryable || isAbort || isNetwork;
      const isIdempotent = method === 'GET' || method === 'HEAD';
      // retry GET always, POST only on network/timeout/5xx (not 4xx)
      const shouldRetry = attempt < RETRY_COUNT && (retryable || (isIdempotent && !e.message.includes('Нэвтрэх')));
      if (shouldRetry) {
        // exponential backoff: 700ms, 1400ms
        await sleep(700 * (attempt + 1) + Math.random() * 300);
        continue;
      }
      if (isAbort) throw new Error('Сервер удаан асаж байна — түр хүлээгээд дахин оролдоно уу (Render free cold start ~30с)');
      throw e;
    }
  }
  throw lastErr;
}
