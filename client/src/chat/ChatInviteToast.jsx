import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Avatar, Badges, PersonName } from './ChatUI.jsx';
import { connectChat } from './chatStream.js';
import { readChatInvites, writeChatInvites } from './chatInvites.js';

export default function ChatInviteToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const path = useRef(location.pathname);
  path.current = location.pathname;
  const [invite, setInvite] = useState(null);
  const [ready, setReady] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dismissed = useRef(null);
  const base = user?.role === 'ADMIN' ? '/admin/chat' : '/student/chat';

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    let running = false;
    let queued = false;
    const hints = new Set();
    let { pending, handled } = readChatInvites(user.id);
    setInvite(null); setReady(null); dismissed.current = null;
    async function refresh(event) {
      if (event?.acceptedInviteId) hints.add(event.acceptedInviteId);
      if (running) { queued = true; return; }
      running = true;
      const receivedHints = new Set(hints);
      try {
        const data = await api('/chat/bootstrap');
        if (!alive) return;
        const accepted = data.invites.filter((item) => item.outgoing && item.status === 'ACCEPTED' && item.roomId && data.rooms.some((room) => room.id === item.roomId) && !handled.has(item.id) && (pending.has(item.id) || receivedHints.has(item.id)));
        for (const item of data.invites) {
          if (item.outgoing && item.status === 'PENDING') pending.add(item.id);
          else pending.delete(item.id);
        }
        pending = new Set([...pending].slice(-100));
        for (const item of accepted) handled.add(item.id);
        handled = new Set([...handled].slice(-100));
        writeChatInvites(user.id, pending, handled);
        for (const id of receivedHints) hints.delete(id);
        setInvite(data.invites.find((item) => item.status === 'PENDING' && !item.outgoing && item.id !== dismissed.current) || null);
        if (accepted.length) {
          if (path.current.startsWith('/student/attempt/')) setReady(accepted[0]);
          else navigate(`${base}?room=${encodeURIComponent(accepted[0].roomId)}`);
        }
      } catch {} finally {
        running = false;
        if (alive && queued) { queued = false; refresh(); }
      }
    }
    const onSent = (event) => {
      if (event.detail.userId !== user.id) return;
      pending.add(event.detail.inviteId);
      refresh();
    };
    window.addEventListener('wa:chat-invite-sent', onSent);
    refresh();
    const stop = connectChat((event) => { if (event.type === 'refresh' || event.type === 'connected') refresh(event); }, () => {});
    const timer = setInterval(refresh, 12000);
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { alive = false; stop(); clearInterval(timer); document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('wa:chat-invite-sent', onSent); };
  }, [user?.id, base, navigate]);

  async function respond(action) {
    if (!invite || busy) return;
    setBusy(true); setError('');
    try {
      const result = await api('/chat/invites/' + invite.id, { method: 'PUT', body: { action } });
      setInvite(null);
      dismissed.current = null;
      if (action === 'accept' && result.invite.roomId) navigate(`${base}?room=${encodeURIComponent(result.invite.roomId)}`);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }

  if (ready) return <aside className="ch-invite-toast" role="status"><div className="ch-invite-toast-head"><Avatar person={ready.peer} small /><strong><PersonName person={ready.peer} /></strong><button type="button" aria-label="Дараа харах" onClick={() => setReady(null)}>×</button></div><p>Урилгыг зөвшөөрлөө. Шалгалтаа дуусгаад хувийн чатдаа ороорой.</p><button type="button" className="ch-primary" onClick={() => { navigate(`${base}?room=${encodeURIComponent(ready.roomId)}`); setReady(null); }}>Хувийн чат нээх</button></aside>;
  if (!invite) return null;
  return <aside className="ch-invite-toast" role="dialog" aria-label="Хувийн чатны хүсэлт"><div className="ch-invite-toast-head"><Avatar person={invite.peer} small /><div><strong><PersonName person={invite.peer} /></strong><Badges badges={invite.peer.badges} /></div><button type="button" aria-label="Дараа харах" onClick={() => { dismissed.current = invite.id; setInvite(null); }}>×</button></div><p>Тантай хувийн чат эхлүүлэх хүсэлт илгээлээ.</p><div><button type="button" disabled={busy} className="ch-primary" onClick={() => respond('accept')}>Зөвшөөрөх</button><button type="button" disabled={busy} className="ch-secondary" onClick={() => respond('decline')}>Татгалзах</button></div>{error && <p role="alert" className="ch-error">{error}</p>}</aside>;
}
