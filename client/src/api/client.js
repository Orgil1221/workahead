const BASE = '/api';
let csrfToken = null;

function getDeviceType() {
  try {
    if (/Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent)) return 'MOBILE';
  } catch {}
  return 'DESKTOP';
}

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
      headers['X-Device-Type'] = getDeviceType();
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

      // retry on Render 502/503/504 waking up — but don't retry app-level gateway errors
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        // Check if it's an app-level gateway error (has JSON code GATEWAY_*), then don't retry
        try {
          const clone = res.clone();
          const maybe = await clone.json().catch(() => ({}));
          if (maybe.code && String(maybe.code).startsWith('GATEWAY')) {
            const e = new Error(maybe.error || `Төлбөрийн гарц алдаа (${res.status})`);
            e.code = maybe.code;
            e.retryable = false;
            throw e;
          }
        } catch (err) {
          if (err.code && String(err.code).startsWith('GATEWAY')) throw err;
        }
        const e = new Error(`Сервер асч байна (${res.status}) — дахин оролдож байна...`);
        e.retryable = true;
        throw e;
      }

      if (res.status === 401) {
        const data401 = await res.clone().json().catch(() => ({}));
        localStorage.removeItem('wa_token');
        localStorage.removeItem('wa_user');
        // Өөр төхөөрөмжөөс нэвтэрсэн — Login дээр монгол мессеж харуулна
        if (data401.code === 'DEVICE_KICKED') {
          try { localStorage.setItem('wa_kicked', '1'); } catch {}
        }
        // don't redirect during warmup health check
        if (path !== '/health' && path !== '/auth/csrf') window.location.href = '/login';
        throw new Error(data401.error || 'Нэвтрэх шаардлагатай');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = new Error(data.error || `Алдаа (${res.status})`);
        e.code = data.code;
        e.detail = data.detail;
        e.status = data.status || res.status;
        // 5xx retryable — but GATEWAY errors are not retryable (already handled above, but double-guard)
        if (res.status >= 500 && !(data.code && String(data.code).startsWith('GATEWAY'))) e.retryable = true;
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
