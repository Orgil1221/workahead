import webpush from 'web-push';
import prisma from '../db.js';

let configured = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:info@workahead.me',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    configured = true;
  } catch (e) {
    console.warn('VAPID keys invalid:', e.message);
  }
} else {
  console.warn('VAPID keys missing — push notifications disabled (set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY)');
}

export const isPushConfigured = () => configured;
export const getVapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

// Унасан subscription (410/404) цэвэрлэх — endpoint буцаж сэргэхгүй
async function removeDeadSubscription(endpoint, statusCode) {
  if (statusCode === 404 || statusCode === 410) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {});
    return true;
  }
  return false;
}

export async function sendPushToSubscription(sub, payload) {
  const res = { sent: false, dead: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    res.sent = true;
  } catch (e) {
    res.dead = await removeDeadSubscription(sub.endpoint, e?.statusCode);
    if (!res.dead) console.warn('push send failed:', e?.message || e);
  }
  return res;
}

// userIds[] → тэдний бүх төхөөрөмж рүү push. Буцаана: { sent, dead, total }
export async function sendPushToUsers(userIds, { title, body, url = '/student/notifications' }) {
  if (!configured) return { sent: 0, dead: 0, total: 0, skipped: 'not-configured' };
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  let sent = 0;
  let dead = 0;
  const payload = { title, body, url };
  for (const sub of subs) {
    const r = await sendPushToSubscription(sub, payload);
    if (r.sent) sent++;
    if (r.dead) dead++;
  }
  return { sent, dead, total: subs.length };
}
