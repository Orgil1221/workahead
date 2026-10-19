import Redis from 'ioredis';

const listeners = new Set();
const channel = 'workahead:chat';
let publisher;
let subscriber;

function deliver(event) {
  for (const listener of listeners) {
    if (!event.users || event.users.includes(listener.userId)) listener.send(event.payload);
  }
}

if (process.env.REDIS_URL) {
  publisher = new Redis(process.env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
  subscriber = publisher.duplicate();
  publisher.on('error', () => {});
  subscriber.on('error', () => {});
  subscriber.on('ready', () => subscriber.subscribe(channel).catch(() => {}));
  subscriber.on('message', (_channel, data) => { try { deliver(JSON.parse(data)); } catch {} });
}

export function emitChat(payload, users = null) {
  const event = { payload, users };
  if (publisher?.status === 'ready' && subscriber?.status === 'ready') {
    publisher.publish(channel, JSON.stringify(event)).catch(() => deliver(event));
  } else deliver(event);
}

export function subscribeChat(userId, send, close) {
  const existing = [...listeners].filter((listener) => listener.userId === userId);
  if (existing.length >= 3) existing[0].close();
  const listener = { userId, send, close };
  listeners.add(listener);
  return () => listeners.delete(listener);
}
