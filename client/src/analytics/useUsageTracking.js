import { useEffect } from 'react';
import { createUsageClock } from './usageClock.js';

export function useUsageTracking(userId, enabled) {
  useEffect(() => {
    if (!enabled || !userId) return;
    let disposed = false;
    let unauthorized = false;
    let initializing = false;
    let inFlight = 0;
    let csrf = null;
    let clock = null;
    let pending = [];
    const token = localStorage.getItem('wa_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
    const foreground = () => document.visibilityState === 'visible' && document.hasFocus();
    async function request(path, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        return await fetch('/api' + path, { credentials: 'include', cache: 'no-store', headers, signal: controller.signal, ...options });
      } finally { clearTimeout(timeout); }
    }
    async function initialize() {
      if (initializing || disposed || unauthorized) return;
      initializing = true;
      try {
        const before = performance.now();
        const [sync, security] = await Promise.all([
          request('/usage').then(async (response) => {
            if (response.status === 401 || response.status === 403) unauthorized = true;
            if (!response.ok) throw new Error('Usage unavailable');
            const data = await response.json();
            return { time: data.serverTime, received: performance.now() };
          }),
          request('/auth/csrf').then((response) => response.ok ? response.json() : null),
        ]);
        if (disposed || unauthorized || !Number.isFinite(sync.time) || !security?.csrfToken) return;
        csrf = security.csrfToken;
        if (!clock) {
          const now = performance.now();
          clock = createUsageClock({ now, serverTime: sync.time + (sync.received - before) / 2 + now - sync.received, visible: foreground() });
        }
      } catch {} finally { initializing = false; }
    }
    async function flush(force = false) {
      if (!clock || unauthorized) return;
      const now = performance.now();
      pending.push(...clock.drain(now));
      const cutoff = Math.floor(clock.serverNow(now) - 240000);
      pending = pending.filter((interval) => interval.end > cutoff).map((interval) => ({ start: Math.max(interval.start, Math.ceil(cutoff)), end: interval.end })).slice(-20);
      if (!pending.length || !csrf || (inFlight && !force)) return;
      const intervals = pending.splice(0, 20);
      inFlight++;
      try {
        const response = await request('/usage', { method: 'POST', keepalive: true, headers: { ...headers, 'x-csrf-token': csrf }, body: JSON.stringify({ intervals }) });
        if (response.status === 401) { unauthorized = true; return; }
        if (response.status === 400) { clock = null; pending = []; return; }
        if (response.status === 403) csrf = null;
        if (!response.ok) throw new Error('Usage not saved');
      } catch {
        if (!disposed) pending = [...intervals, ...pending].slice(-20);
      } finally { inFlight--; }
    }
    const activity = (event) => {
      if (event.isTrusted && foreground()) clock?.activity(performance.now());
    };
    const visibility = () => {
      clock?.visibility(foreground(), performance.now());
      if (!foreground()) void flush(true);
    };
    const pageHide = () => { clock?.visibility(false, performance.now()); void flush(true); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    for (const event of events) document.addEventListener(event, activity, { passive: true, capture: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', visibility);
    window.addEventListener('blur', visibility);
    window.addEventListener('pageshow', visibility);
    window.addEventListener('pagehide', pageHide);
    const sampleTimer = setInterval(() => clock?.sample(performance.now()), 1000);
    const uploadTimer = setInterval(() => {
      if (!clock || !csrf) void initialize();
      else void flush();
    }, 30000);
    void initialize();
    return () => {
      disposed = true;
      clock?.visibility(false, performance.now());
      void flush(true);
      clearInterval(sampleTimer);
      clearInterval(uploadTimer);
      for (const event of events) document.removeEventListener(event, activity, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility);
      window.removeEventListener('blur', visibility);
      window.removeEventListener('pageshow', visibility);
      window.removeEventListener('pagehide', pageHide);
    };
  }, [userId, enabled]);
}
