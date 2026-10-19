const storageKey = (userId) => `wa_chat_invites:v1:${userId}`;
const identifiers = (values) => new Set(Array.isArray(values) ? values.filter((value) => typeof value === 'string').slice(-100) : []);

export function readChatInvites(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(userId)));
    return { pending: identifiers(saved?.pending), handled: identifiers(saved?.handled) };
  } catch { return { pending: new Set(), handled: new Set() }; }
}

export function writeChatInvites(userId, pending, handled) {
  try { sessionStorage.setItem(storageKey(userId), JSON.stringify({ pending: [...pending].slice(-100), handled: [...handled].slice(-100) })); } catch {}
}

export function rememberChatInvite(userId, invite) {
  if (invite.status !== 'PENDING' || invite.senderId !== userId) return;
  const { pending, handled } = readChatInvites(userId);
  pending.add(invite.id);
  writeChatInvites(userId, pending, handled);
  window.dispatchEvent(new CustomEvent('wa:chat-invite-sent', { detail: { userId, inviteId: invite.id } }));
}
