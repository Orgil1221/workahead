const BASE = '/api';
let csrfToken = null;
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const r = await fetch(BASE + '/auth/csrf', { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    if (d.csrfToken) csrfToken = d.csrfToken;
  } catch {}
  return csrfToken;
}

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = localStorage.getItem('wa_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  // CSRF for state-changing requests (login/register excluded server-side)
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = await getCsrfToken();
    if (csrf) headers['x-csrf-token'] = csrf;
  }

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (res.status === 401) {
    localStorage.removeItem('wa_token');
    localStorage.removeItem('wa_user');
    window.location.href = '/login';
    throw new Error('Нэвтрэх шаардлагатай');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Алдаа (${res.status})`);
  return data;
}
