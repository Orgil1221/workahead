/* WorkAhead service worker — Web Push харуулна + дарахаар нээнэ.
   Vite `public/sw.js` → build-д `/sw.js` болон хувилна. Гараар бичсэн, Workbox үгүй. */
// Шинэ хувилбар шууд идэвхжих — хуучин SW гацсан таб дээр шинэчлэгдэхгүй байх асуудлаас сэргийлнэ
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'WorkAhead', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'WorkAhead';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    data: { url: data.url || '/student/notifications' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/student/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.includes(url) && 'focus' in w) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
