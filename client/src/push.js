import { api } from './api/client.js';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const pushSupport = {
  get serviceWorker() { return 'serviceWorker' in navigator; },
  get push() { return 'PushManager' in window; },
  get notification() { return 'Notification' in window; },
  get supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
  permission() { return 'Notification' in window ? Notification.permission : 'unsupported'; },
};

async function ensureRegistration() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  // Шинэ SW шууд идэвхжих (update хүлээлтгүй)
  if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  return reg;
}

async function getPublicKey() {
  const d = await api('/push/public-key');
  return d.publicKey;
}

export async function getSubscriptionState() {
  if (!pushSupport.supported) return { supported: false, permission: 'unsupported', subscribed: false };
  const reg = await ensureRegistration();
  const sub = await reg.pushManager.getSubscription();
  return {
    supported: true,
    permission: pushSupport.permission(),
    subscribed: !!sub,
    endpoint: sub ? sub.endpoint : null,
  };
}

// Push асаах — permission + subscribe + серверт бүртгэх
export async function enablePush() {
  if (!pushSupport.supported) throw new Error('Энэ browser push дэмжихгүй байна');
  if (Notification.permission === 'denied') {
    throw new Error('Notification хориглогдсон — browser тохиргооноос зөвшөөрнө үү (Site settings → Notifications → Allow)');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Зөвшөөрөл өгсөнгүй — push ирэхгүй');
  const publicKey = await getPublicKey();
  const reg = await ensureRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = sub.toJSON();
  await api('/push/subscribe', {
    method: 'POST',
    body: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return { endpoint: json.endpoint };
}

// Push унтраах — browser + серверээс хасах
export async function disablePush() {
  const reg = await ensureRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
    } catch {}
    await sub.unsubscribe();
  }
}

// Тест push — өөрийн бүх төхөөрөмж рүү
export async function sendTestPush(title, body) {
  return api('/push/test', { method: 'POST', body: { title, body } });
}
