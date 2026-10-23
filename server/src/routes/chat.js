import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { rateLimitFlexible } from '../middleware/rateLimitFlexible.js';
import { badgeCatalog, badgeColors, chatPeople, publicPerson } from '../services/chatBadges.js';
import { emitChat, subscribeChat } from '../services/chatEvents.js';

const router = Router();
const run = (handler) => async (req, res, next) => { try { await handler(req, res); } catch (error) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Оруулсан мэдээллээ шалгана уу.' });
  if (error.code === 'P2034') return res.status(409).json({ error: 'Мэдээлэл өөрчлөгдлөө. Дахин оролдоно уу.' });
  next(error);
} };
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const idSchema = z.string().min(1).max(100);
const pairKey = (first, second) => [first, second].sort().join(':');
const isMember = (userId) => ({ members: { some: { userId } } });
const transaction = (action) => prisma.$transaction(action, { isolationLevel: 'Serializable' });
const replySelect = { id: true, roomId: true, userId: true, body: true, deletedAt: true };
const heartInclude = (userId) => ({ _count: { select: { hearts: true } }, hearts: { where: { userId }, select: { userId: true } } });
const referencesSchema = {
  replyToId: idSchema.nullable().optional(),
  mentions: z.array(z.object({ userId: idSchema, start: z.number().int().min(0), end: z.number().int().positive() })).max(10).default([]),
};

async function requireChatWrite(database, user) {
  if (user.role === 'ADMIN') return;
  const profile = await database.chatProfile.findUnique({ where: { userId: user.id }, select: { timeoutUntil: true } });
  if (profile?.timeoutUntil > new Date()) fail(403, `Chat mute идэвхтэй байна. ${profile.timeoutUntil.toISOString()} хүртэл бичих боломжгүй.`);
}

async function validateReply(database, replyToId, roomId, userId) {
  if (!replyToId) return;
  const reply = await database.chatMessage.findFirst({ where: { id: replyToId, roomId, deletedAt: null }, select: { userId: true } });
  if (!reply || await blocked(database, userId, reply.userId)) fail(404, 'Хариулах мессеж боломжгүй байна.');
}

async function validateMentions(database, mentions, body, room, userId) {
  if (!mentions.length) return [];
  if (body.startsWith('WAQ1:')) fail(400, 'Асуултын дотор mention оруулах боломжгүй.');
  const users = await database.user.findMany({ where: { id: { in: mentions.map((mention) => mention.userId) } }, select: { id: true, name: true } });
  const blocks = await database.chatBlock.findMany({ where: { OR: [{ userId }, { blockedId: userId }] } });
  const hidden = new Set(blocks.map((block) => block.userId === userId ? block.blockedId : block.userId));
  const ordered = [...mentions].sort((first, second) => first.start - second.start);
  let previousEnd = 0;
  for (const mention of ordered) {
    const person = users.find((user) => user.id === mention.userId);
    if (!person || hidden.has(person.id) || (room && !room.members.some((member) => member.userId === person.id))) fail(400, 'Энэ хэрэглэгчийг уг чатад дурдах боломжгүй.');
    if (mention.start < previousEnd || mention.end > body.length || body.slice(mention.start, mention.end) !== '@' + person.name) fail(400, 'Mention мэдээлэл буруу байна. Дахин хэрэглэгчээ сонгоно уу.');
    previousEnd = mention.end;
  }
  return ordered;
}

function messagePeople(message) {
  return [message.userId, ...(message.replyTo ? [message.replyTo.userId] : []), ...(Array.isArray(message.mentions) ? message.mentions.map((mention) => mention.userId) : [])];
}

function visibleMentions(message, people, hidden) {
  if (message.deletedAt || !Array.isArray(message.mentions)) return [];
  return message.mentions.filter((mention) => people.has(mention.userId) && !hidden.has(mention.userId)).map((mention) => ({ ...mention, person: publicPerson(people.get(mention.userId)) }));
}

function serializeMessage(message, people, hidden) {
  const reply = message.replyTo;
  const unavailable = reply && (reply.roomId !== message.roomId || hidden.has(reply.userId));
  return { id: message.id, clientId: message.clientId, roomId: message.roomId, body: message.deletedAt ? '' : message.body, deleted: Boolean(message.deletedAt), createdAt: message.createdAt,
    author: publicPerson(people.get(message.userId)), saved: Boolean(message.saved?.length), mentions: visibleMentions(message, people, hidden), system: message.deletedAt ? null : message.system,
    heart: { count: message.deletedAt ? 0 : message._count?.hearts || 0, active: !message.deletedAt && Boolean(message.hearts?.length) },
    reply: !message.deletedAt && reply ? { id: reply.id, unavailable: Boolean(unavailable), deleted: Boolean(reply.deletedAt), body: unavailable || reply.deletedAt ? '' : reply.body, author: unavailable ? null : publicPerson(people.get(reply.userId)) } : null,
  };
}

async function blocked(database, first, second) {
  return database.chatBlock.findFirst({ where: { OR: [{ userId: first, blockedId: second }, { userId: second, blockedId: first }] } });
}

async function roomAccess(database, roomId, userId) {
  if (roomId === 'all') return null;
  const room = await database.chatRoom.findFirst({ where: { id: roomId, ...isMember(userId) }, include: { members: true } });
  if (!room) fail(404, 'Чат олдсонгүй.');
  const other = room.members.find((member) => member.userId !== userId);
  if (!other || await blocked(database, userId, other.userId)) fail(403, 'Энэ хувийн чат хаалттай байна.');
  return room;
}

async function requirePremium(database, user) {
  if (user.role === 'ADMIN') return;
  const plan = await database.paymentTransaction.findFirst({ where: { userId: user.id, status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  if (!plan) fail(403, 'Энэ боломжийг ашиглахын тулд идэвхтэй багцтай байх шаардлагатай.');
}

async function notifyRoom(roomId, payload) {
  const users = roomId === 'all' ? null : (await prisma.chatMember.findMany({ where: { roomId }, select: { userId: true } })).map((member) => member.userId);
  emitChat({ roomId, ...payload }, users);
}

router.use(requireAuth);
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/visit', run(async (req, res) => {
  const profile = await prisma.chatProfile.findUnique({ where: { userId: req.user.id }, select: { hasVisited: true } });
  res.json({ hasVisited: Boolean(profile?.hasVisited) });
}));

router.put('/visit', run(async (req, res) => {
  await prisma.chatProfile.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id, hasVisited: true }, update: { hasVisited: true } });
  res.json({ hasVisited: true });
}));

router.get('/bootstrap', run(async (req, res) => {
  const publicRoom = await prisma.chatRoom.upsert({ where: { id: 'all' }, create: { id: 'all', kind: 'PUBLIC' }, update: {}, include: { pinnedMessage: { select: { ...replySelect, createdAt: true, mentions: true } } } });
  const [people, rooms, invites, blocks] = await Promise.all([
    chatPeople([req.user.id, ...(publicRoom.pinnedMessage ? messagePeople(publicRoom.pinnedMessage) : [])]),
    prisma.chatRoom.findMany({ where: { kind: 'DIRECT', ...isMember(req.user.id) }, include: { members: true, messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { createdAt: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.chatInvite.findMany({ where: { OR: [{ senderId: req.user.id }, { recipientId: req.user.id }] }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.chatBlock.findMany({ where: { OR: [{ userId: req.user.id }, { blockedId: req.user.id }] } }),
  ]);
  const hiddenIds = new Set(blocks.map((block) => block.userId === req.user.id ? block.blockedId : block.userId));
  const peers = await chatPeople([...rooms.flatMap((room) => room.members.map((member) => member.userId)), ...invites.flatMap((invite) => [invite.senderId, invite.recipientId]), ...blocks.map((block) => block.blockedId)]);
  const visibleRooms = rooms.filter((room) => !room.members.some((member) => hiddenIds.has(member.userId)));
  const pinned = publicRoom.pinnedMessage;
  res.json({ me: people.get(req.user.id), catalog: badgeCatalog, colors: badgeColors,
    pinned: pinned && pinned.roomId === 'all' && !pinned.deletedAt && !hiddenIds.has(pinned.userId) ? { id: pinned.id, body: pinned.body, createdAt: pinned.createdAt, author: publicPerson(people.get(pinned.userId)), mentions: visibleMentions(pinned, people, hiddenIds) } : null,
    rooms: visibleRooms.map((room) => ({ id: room.id, peer: publicPerson(peers.get(room.members.find((member) => member.userId !== req.user.id)?.userId)), unread: Boolean(room.messages[0] && room.messages[0].createdAt > room.members.find((member) => member.userId === req.user.id).readAt) })),
    invites: invites.filter((invite) => !hiddenIds.has(invite.senderId) && !hiddenIds.has(invite.recipientId)).map((invite) => ({ id: invite.id, status: invite.status, outgoing: invite.senderId === req.user.id, peer: publicPerson(peers.get(invite.senderId === req.user.id ? invite.recipientId : invite.senderId)), roomId: invite.roomId })),
    blocked: blocks.filter((block) => block.userId === req.user.id).map((block) => publicPerson(peers.get(block.blockedId))), hiddenIds: [...hiddenIds],
  });
}));

router.get('/people', run(async (req, res) => {
  const search = z.string().trim().max(80).parse(req.query.q || '');
  const room = req.query.room ? await roomAccess(prisma, idSchema.parse(req.query.room), req.user.id) : null;
  const blocks = req.query.room ? await prisma.chatBlock.findMany({ where: { OR: [{ userId: req.user.id }, { blockedId: req.user.id }] } }) : [];
  const hidden = blocks.map((block) => block.userId === req.user.id ? block.blockedId : block.userId);
  const rows = await prisma.user.findMany({ where: { id: { not: req.user.id, notIn: hidden, ...(room ? { in: room.members.map((member) => member.userId) } : {}) }, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true }, take: req.query.room ? 8 : 30 });
  const people = await chatPeople(rows.map((row) => row.id));
  res.json({ people: [...people.values()].map(publicPerson) });
}));

router.get('/people/:id/moderation', requireAdmin, run(async (req, res) => {
  const person = (await chatPeople([idSchema.parse(req.params.id)])).get(req.params.id);
  if (!person) fail(404, 'Хэрэглэгч олдсонгүй.');
  res.json({ person: publicPerson(person) });
}));

router.post('/people/:id/timeout', requireAdmin, run(async (req, res) => {
  const targetId = idSchema.parse(req.params.id);
  const { action, minutes, clientId } = z.object({ action: z.enum(['mute', 'unmute']), minutes: z.union([z.literal(30), z.literal(60), z.literal(180)]).optional(), clientId: z.string().uuid() }).refine((value) => value.action !== 'mute' || value.minutes != null).parse(req.body);
  await transaction(async (database) => {
    const target = await database.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, role: true, chatProfile: { select: { timeoutUntil: true } } } });
    if (!target) fail(404, 'Хэрэглэгч олдсонгүй.');
    if (target.role === 'ADMIN' || target.id === req.user.id) fail(403, 'Админыг mute хийх боломжгүй.');
    const existing = await database.chatMessage.findUnique({ where: { userId_clientId: { userId: req.user.id, clientId } } });
    if (existing) {
      if (existing.system?.type !== action || existing.system?.targetId !== targetId || (action === 'mute' && existing.system?.minutes !== minutes)) fail(409, 'Үйлдлийн дугаар давхардлаа.');
      return;
    }
    if (action === 'unmute' && !(target.chatProfile?.timeoutUntil > new Date())) fail(409, 'Энэ хэрэглэгчийн mute аль хэдийн дууссан байна.');
    const timeoutUntil = action === 'mute' ? new Date(Date.now() + minutes * 60000) : null;
    await database.chatProfile.upsert({ where: { userId: targetId }, create: { userId: targetId, timeoutUntil }, update: { timeoutUntil } });
    await database.chatRoom.upsert({ where: { id: 'all' }, create: { id: 'all', kind: 'PUBLIC' }, update: {} });
    const label = '@' + target.name;
    await database.chatMessage.create({ data: { roomId: 'all', userId: req.user.id, clientId,
      body: action === 'mute' ? `${label} mute хийгдлээ · ${minutes === 30 ? '30 минут' : minutes / 60 + ' цаг'}.` : `${label} mute цуцлагдлаа.`,
      mentions: [{ userId: targetId, start: 0, end: label.length }], system: { type: action, targetId, minutes: action === 'mute' ? minutes : null, timeoutUntil: timeoutUntil?.toISOString() || null },
    } });
  });
  emitChat({ type: 'refresh' });
  res.json({ person: publicPerson((await chatPeople([targetId])).get(targetId)) });
}));

router.post('/people/:id/gift', requireAdmin, run(async (req, res) => {
  const targetId = idSchema.parse(req.params.id);
  const { planId, clientId } = z.object({ planId: idSchema, clientId: z.string().uuid() }).parse(req.body);
  const transactionId = `chat-gift-${req.user.id}-${clientId}`;
  const gift = await transaction(async (database) => {
    const existing = await database.paymentTransaction.findUnique({ where: { transactionId } });
    if (existing) {
      if (existing.userId !== targetId || existing.planId !== planId) fail(409, 'Бэлгийн дугаар давхардлаа.');
      return existing;
    }
    const target = await database.user.findUnique({ where: { id: targetId }, select: { role: true } });
    if (!target) fail(404, 'Хэрэглэгч олдсонгүй.');
    if (target.role !== 'STUDENT') fail(400, 'Зөвхөн суралцагчид эрх бэлэглэнэ.');
    const plan = await database.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) fail(404, 'Идэвхтэй багц олдсонгүй.');
    const now = new Date();
    const active = await database.paymentTransaction.findFirst({ where: { userId: targetId, status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { expiresAt: 'desc' } });
    const base = active?.expiresAt && active.expiresAt > now ? active.expiresAt : now;
    return database.paymentTransaction.create({ data: { userId: targetId, planId, transactionId, amount: 0, status: 'PAID', provider: 'GIFT', completedAt: now, expiresAt: new Date(base.getTime() + 30 * 86400000) } });
  });
  emitChat({ type: 'refresh' });
  res.json({ giftId: gift.id, expiresAt: gift.expiresAt, person: publicPerson((await chatPeople([targetId])).get(targetId)) });
}));

router.get('/questions', run(async (req, res) => {
  const roomId = idSchema.parse(req.query.room || '');
  await roomAccess(prisma, roomId, req.user.id);
  const search = z.string().trim().max(100).parse(req.query.q || '');
  const before = req.query.before ? await prisma.bookmark.findUnique({ where: { userId_questionId: { userId: req.user.id, questionId: idSchema.parse(req.query.before) } } }) : null;
  if (req.query.before && !before) fail(400, 'Жагсаалтаа дахин ачаална уу.');
  const rows = await prisma.bookmark.findMany({
    where: { userId: req.user.id,
      ...(search ? { question: { OR: [{ prompt: { contains: search, mode: 'insensitive' } }, { topic: { contains: search, mode: 'insensitive' } }, { exam: { title: { contains: search, mode: 'insensitive' } } }] } } : {}),
      ...(before ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, questionId: { lt: before.questionId } }] } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { questionId: 'desc' }], take: 26,
    select: { question: { select: { id: true, prompt: true, choices: true, topic: true, points: true, year: true, exam: { select: { title: true, year: true } } } } },
  });
  const page = rows.slice(0, 25);
  res.json({ questions: page.map(({ question }) => questionSnapshot(question)), nextCursor: rows.length > 25 ? page.at(-1).question.id : null });
}));

function questionSnapshot(question) {
  return { type: 'question', id: question.id, prompt: question.prompt, choices: Array.isArray(question.choices) ? question.choices.map((choice) => ({ key: choice.key, text: choice.text })) : [], examTitle: question.exam.title, year: question.year || question.exam.year, topic: question.topic, points: question.points };
}

router.post('/rooms/:roomId/questions', rateLimitFlexible('chatMessage'), run(async (req, res) => {
  const roomId = idSchema.parse(req.params.roomId);
  const { questionId, clientId = randomUUID(), replyToId } = z.object({ questionId: idSchema, clientId: z.string().uuid().optional(), replyToId: referencesSchema.replyToId }).parse(req.body);
  const message = await transaction(async (database) => {
    await roomAccess(database, roomId, req.user.id);
    await requireChatWrite(database, req.user);
    const existing = await database.chatMessage.findUnique({ where: { userId_clientId: { userId: req.user.id, clientId } } });
    if (existing) { if (existing.roomId !== roomId) fail(409, 'Мессежийн дугаар давхардлаа.'); return existing; }
    await validateReply(database, replyToId, roomId, req.user.id);
    const saved = await database.bookmark.findUnique({ where: { userId_questionId: { userId: req.user.id, questionId } }, select: { question: { select: { id: true, prompt: true, choices: true, topic: true, points: true, year: true, exam: { select: { title: true, year: true } } } } } });
    if (!saved) fail(404, 'Энэ асуулт таны хадгалсан жагсаалтад алга.');
    const snapshot = questionSnapshot(saved.question);
    const body = 'WAQ1:' + JSON.stringify(snapshot);
    if (body.length > 20000) fail(413, 'Энэ асуулт чатад хуваалцахад хэт урт байна.');
    return database.chatMessage.create({ data: { roomId, userId: req.user.id, clientId, body, replyToId } });
  });
  await notifyRoom(roomId, { type: 'refresh' });
  res.json({ id: message.id });
}));

router.put('/profile', run(async (req, res) => {
  const data = z.object({ selectedBadge: z.string().max(40).nullable(), badgeColor: z.enum(badgeColors), allowInvites: z.boolean(), muted: z.boolean() }).parse(req.body);
  const me = (await chatPeople([req.user.id])).get(req.user.id);
  if (data.selectedBadge && !me.earned.some((badge) => badge.id === data.selectedBadge)) fail(403, 'Энэ badge хараахан нээгдээгүй байна.');
  await prisma.chatProfile.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id, ...data }, update: data });
  emitChat({ type: 'refresh' });
  res.json({ ok: true });
}));

router.get('/rooms/:roomId/messages', run(async (req, res) => {
  const roomId = idSchema.parse(req.params.roomId);
  await roomAccess(prisma, roomId, req.user.id);
  const search = z.string().trim().max(100).parse(req.query.q || '');
  const saved = req.query.saved === '1';
  if (search || saved) await requirePremium(prisma, req.user);
  const blocks = await prisma.chatBlock.findMany({ where: { OR: [{ userId: req.user.id }, { blockedId: req.user.id }] } });
  const hidden = blocks.map((block) => block.userId === req.user.id ? block.blockedId : block.userId);
  const before = req.query.before ? await prisma.chatMessage.findFirst({ where: { id: idSchema.parse(req.query.before), roomId } }) : null;
  if (req.query.before && !before) fail(400, 'Хуудасны зааг буруу байна.');
  const rows = await prisma.chatMessage.findMany({ where: { roomId, userId: { notIn: hidden },
    ...(search ? { deletedAt: null, body: { contains: search, mode: 'insensitive' } } : {}),
    ...(saved ? { saved: { some: { userId: req.user.id } }, deletedAt: null } : {}),
    ...(before ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }] } : {}),
  }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 41,
    include: { saved: { where: { userId: req.user.id }, select: { userId: true } }, replyTo: { select: replySelect }, ...heartInclude(req.user.id) },
  });
  const page = rows.slice(0, 40);
  const people = await chatPeople(page.flatMap(messagePeople));
  res.json({ messages: page.reverse().map((message) => serializeMessage(message, people, new Set(hidden))), hasMore: rows.length > 40 });
}));

router.get('/rooms/:roomId/messages/:messageId', run(async (req, res) => {
  const roomId = idSchema.parse(req.params.roomId);
  await roomAccess(prisma, roomId, req.user.id);
  const message = await prisma.chatMessage.findFirst({ where: { id: idSchema.parse(req.params.messageId), roomId }, include: { replyTo: { select: replySelect }, ...heartInclude(req.user.id) } });
  if (!message || await blocked(prisma, req.user.id, message.userId)) fail(404, 'Мессеж боломжгүй байна.');
  const blocks = await prisma.chatBlock.findMany({ where: { OR: [{ userId: req.user.id }, { blockedId: req.user.id }] } });
  const hidden = new Set(blocks.map((block) => block.userId === req.user.id ? block.blockedId : block.userId));
  const people = await chatPeople(messagePeople(message));
  res.json({ message: serializeMessage(message, people, hidden) });
}));

router.post('/rooms/:roomId/messages', rateLimitFlexible('chatMessage'), run(async (req, res) => {
  const roomId = idSchema.parse(req.params.roomId);
  const data = z.object({ body: z.string().trim().min(1).max(2000), clientId: z.string().uuid(), ...referencesSchema }).parse(req.body);
  const message = await transaction(async (database) => {
    const room = await roomAccess(database, roomId, req.user.id);
    await requireChatWrite(database, req.user);
    const existing = await database.chatMessage.findUnique({ where: { userId_clientId: { userId: req.user.id, clientId: data.clientId } } });
    if (existing) { if (existing.roomId !== roomId) fail(409, 'Мессежийн дугаар давхардлаа.'); return existing; }
    await validateReply(database, data.replyToId, roomId, req.user.id);
    const mentions = await validateMentions(database, data.mentions, data.body, room, req.user.id);
    return database.chatMessage.create({ data: { roomId, userId: req.user.id, ...data, mentions } });
  });
  await notifyRoom(roomId, { type: 'refresh' });
  res.json({ id: message.id });
}));

router.post('/rooms/:roomId/read', run(async (req, res) => {
  await roomAccess(prisma, req.params.roomId, req.user.id);
  await prisma.chatMember.updateMany({ where: { roomId: req.params.roomId, userId: req.user.id }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

router.post('/rooms/:roomId/typing', rateLimitFlexible('chatTyping'), run(async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  if (active) await requireChatWrite(prisma, req.user);
  await roomAccess(prisma, req.params.roomId, req.user.id);
  await notifyRoom(req.params.roomId, { type: 'typing', userId: req.user.id, name: req.user.name, active });
  res.json({ ok: true });
}));

router.post('/invites', rateLimitFlexible('chatInvite'), run(async (req, res) => {
  const { recipientId } = z.object({ recipientId: idSchema }).parse(req.body);
  if (recipientId === req.user.id) fail(400, 'Өөртөө урилга илгээх боломжгүй.');
  const invite = await transaction(async (database) => {
    await requireChatWrite(database, req.user);
    await requirePremium(database, req.user);
    const recipient = await database.user.findUnique({ where: { id: recipientId }, include: { chatProfile: true } });
    if (!recipient || recipient.chatProfile?.allowInvites === false || await blocked(database, req.user.id, recipientId)) fail(403, 'Энэ хэрэглэгчид урилга илгээх боломжгүй.');
    const key = pairKey(req.user.id, recipientId);
    const existing = await database.chatInvite.findUnique({ where: { pairKey: key } });
    if (existing) {
      if (existing.status === 'PENDING' || existing.status === 'ACCEPTED') return existing;
      if (existing.status === 'DECLINED') {
        const remaining = 60000 - (Date.now() - existing.updatedAt.getTime());
        if (remaining > 0) fail(429, `Татгалзсанаас хойш ${Math.ceil(remaining / 1000)} секунд хүлээгээд дахин хүсэлт илгээнэ үү.`);
        return database.chatInvite.update({ where: { id: existing.id }, data: { senderId: req.user.id, recipientId, status: 'PENDING', roomId: null, createdAt: new Date(), updatedAt: new Date() } });
      }
      fail(409, 'Энэ хэрэглэгчтэй урилгыг аль хэдийн шийдвэрлэсэн байна.');
    }
    const count = await database.chatInvite.count({ where: { senderId: req.user.id, createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (count >= 10) fail(429, '24 цагт 10 урилга илгээх боломжтой.');
    return database.chatInvite.create({ data: { senderId: req.user.id, recipientId, pairKey: key } });
  });
  emitChat({ type: 'refresh' }, [req.user.id, recipientId]);
  res.json({ invite });
}));

router.put('/invites/:id', run(async (req, res) => {
  const { action } = z.object({ action: z.enum(['accept', 'decline', 'cancel']) }).parse(req.body);
  const { invite, accepted } = await transaction(async (database) => {
    const current = await database.chatInvite.findUnique({ where: { id: req.params.id } });
    if (!current || (action === 'cancel' ? current.senderId : current.recipientId) !== req.user.id) fail(404, 'Урилга олдсонгүй.');
    if (current.status !== 'PENDING') return { invite: current, accepted: false };
    if (action === 'accept') {
      if (await blocked(database, current.senderId, current.recipientId)) fail(403, 'Блоклосон хэрэглэгчтэй чат нээх боломжгүй.');
      const room = await database.chatRoom.create({ data: { pairKey: current.pairKey, members: { create: [{ userId: current.senderId }, { userId: current.recipientId }] } } });
      const updated = await database.chatInvite.update({ where: { id: current.id }, data: { status: 'ACCEPTED', roomId: room.id } });
      return { invite: updated, accepted: true };
    }
    const updated = await database.chatInvite.update({ where: { id: current.id }, data: { status: action === 'cancel' ? 'CANCELLED' : 'DECLINED' } });
    return { invite: updated, accepted: false };
  });
  emitChat({ type: 'refresh', ...(accepted ? { acceptedInviteId: invite.id } : {}) }, [invite.senderId, invite.recipientId]);
  res.json({ invite });
}));

router.put('/blocks/:userId', run(async (req, res) => {
  const target = idSchema.parse(req.params.userId);
  const { blocked: enabled } = z.object({ blocked: z.boolean() }).parse(req.body);
  if (target === req.user.id) fail(400, 'Өөрийгөө блоклох боломжгүй.');
  await transaction(async (database) => {
    if (!await database.user.findUnique({ where: { id: target }, select: { id: true } })) fail(404, 'Хэрэглэгч олдсонгүй.');
    if (enabled) {
      await database.chatBlock.upsert({ where: { userId_blockedId: { userId: req.user.id, blockedId: target } }, create: { userId: req.user.id, blockedId: target }, update: {} });
      await database.chatInvite.updateMany({ where: { pairKey: pairKey(req.user.id, target), status: 'PENDING' }, data: { status: 'DECLINED' } });
    } else await database.chatBlock.deleteMany({ where: { userId: req.user.id, blockedId: target } });
  });
  emitChat({ type: 'refresh' }, [req.user.id, target]);
  res.json({ ok: true });
}));

router.put('/messages/:id/heart', rateLimitFlexible('chatReaction'), run(async (req, res) => {
  const messageId = idSchema.parse(req.params.id);
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  const roomId = await transaction(async (database) => {
    const message = await database.chatMessage.findUnique({ where: { id: messageId }, select: { roomId: true, userId: true, deletedAt: true, system: true } });
    if (!message || message.deletedAt) fail(404, 'Мессеж боломжгүй байна.');
    await roomAccess(database, message.roomId, req.user.id);
    if (await blocked(database, req.user.id, message.userId)) fail(404, 'Мессеж боломжгүй байна.');
    if (message.system) fail(400, 'Системийн мэдэгдэлд зүрх дарах боломжгүй.');
    await requireChatWrite(database, req.user);
    if (active) await database.chatHeart.upsert({ where: { userId_messageId: { userId: req.user.id, messageId } }, create: { userId: req.user.id, messageId }, update: {} });
    else await database.chatHeart.deleteMany({ where: { userId: req.user.id, messageId } });
    return message.roomId;
  });
  await notifyRoom(roomId, { type: 'reaction', messageId });
  res.json({ ok: true });
}));

router.put('/messages/:id/save', run(async (req, res) => {
  const { saved } = z.object({ saved: z.boolean() }).parse(req.body);
  const message = await prisma.chatMessage.findUnique({ where: { id: req.params.id } });
  if (!message || message.deletedAt) fail(404, 'Мессеж олдсонгүй.');
  await roomAccess(prisma, message.roomId, req.user.id);
  if (await blocked(prisma, req.user.id, message.userId)) fail(403, 'Мессеж боломжгүй байна.');
  if (saved) {
    await requirePremium(prisma, req.user);
    await prisma.chatSavedMessage.upsert({ where: { userId_messageId: { userId: req.user.id, messageId: message.id } }, create: { userId: req.user.id, messageId: message.id }, update: {} });
  } else await prisma.chatSavedMessage.deleteMany({ where: { userId: req.user.id, messageId: message.id } });
  res.json({ ok: true });
}));

router.put('/messages/:id/pin', requireAdmin, run(async (req, res) => {
  const messageId = idSchema.parse(req.params.id);
  const { pinned } = z.object({ pinned: z.boolean() }).parse(req.body);
  await transaction(async (database) => {
    const message = await database.chatMessage.findFirst({ where: { id: messageId, roomId: 'all', deletedAt: null }, select: { id: true } });
    if (!message) fail(404, 'Тогтоох боломжтой нийтийн мессеж олдсонгүй.');
    if (pinned) await database.chatRoom.update({ where: { id: 'all' }, data: { pinnedMessageId: message.id } });
    else await database.chatRoom.updateMany({ where: { id: 'all', pinnedMessageId: message.id }, data: { pinnedMessageId: null } });
  });
  await notifyRoom('all', { type: 'refresh' });
  res.json({ ok: true });
}));

router.delete('/messages/:id', run(async (req, res) => {
  const message = await prisma.chatMessage.findUnique({ where: { id: req.params.id } });
  if (!message) fail(404, 'Мессеж олдсонгүй.');
  const report = req.user.role === 'ADMIN' ? await prisma.chatReport.findFirst({ where: { messageId: message.id } }) : null;
  if (message.userId !== req.user.id && !(req.user.role === 'ADMIN' && (message.roomId === 'all' || report))) fail(403, 'Устгах эрхгүй.');
  await prisma.$transaction([
    prisma.chatMessage.update({ where: { id: message.id }, data: { body: '', mentions: [], deletedAt: new Date() } }),
    prisma.chatHeart.deleteMany({ where: { messageId: message.id } }),
    prisma.chatReport.updateMany({ where: { messageId: message.id }, data: { resolved: true } }),
    prisma.chatRoom.updateMany({ where: { pinnedMessageId: message.id }, data: { pinnedMessageId: null } }),
  ]);
  await notifyRoom(message.roomId, { type: 'deleted', messageId: message.id });
  res.json({ ok: true });
}));

router.post('/messages/:id/report', rateLimitFlexible('chatReport'), run(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
  const message = await prisma.chatMessage.findUnique({ where: { id: req.params.id } });
  if (!message || message.deletedAt) fail(404, 'Мессеж олдсонгүй.');
  await roomAccess(prisma, message.roomId, req.user.id);
  await prisma.chatReport.upsert({ where: { userId_messageId: { userId: req.user.id, messageId: message.id } }, create: { userId: req.user.id, messageId: message.id, reason }, update: { reason } });
  res.json({ ok: true });
}));

router.get('/reports', requireAdmin, run(async (_req, res) => {
  const reports = await prisma.chatReport.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 50, include: { message: { select: { id: true, body: true, userId: true, roomId: true } } } });
  const people = await chatPeople(reports.flatMap((report) => [report.userId, report.message.userId]));
  res.json({ reports: reports.map((report) => ({ ...report, reporter: publicPerson(people.get(report.userId)), author: publicPerson(people.get(report.message.userId)) })) });
}));

router.put('/reports/:id', requireAdmin, run(async (req, res) => {
  await prisma.chatReport.updateMany({ where: { id: req.params.id }, data: { resolved: true } });
  res.json({ ok: true });
}));

router.get('/events', run(async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  let closed = false;
  let unsubscribe = () => {};
  let heartbeat;
  let expiry;
  const close = () => { if (closed) return; closed = true; unsubscribe(); clearInterval(heartbeat); clearTimeout(expiry); res.end(); };
  const send = (event) => { if (!closed && !res.write(`data: ${JSON.stringify(event)}\n\n`)) close(); };
  unsubscribe = subscribeChat(req.user.id, send, close);
  heartbeat = setInterval(async () => {
    try {
      const session = await prisma.userSession.findUnique({ where: { jti: req.jti } });
      if (!session || session.expiresAt <= new Date()) return close();
      res.write(': heartbeat\n\n');
    } catch { close(); }
  }, 15000);
  expiry = setTimeout(close, 5 * 60 * 1000);
  res.on('close', close);
  send({ type: 'connected' });
}));

export default router;
