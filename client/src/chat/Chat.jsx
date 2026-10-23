import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Avatar, Badges, ChatDialog, ChatIcon, PersonName } from './ChatUI.jsx';
import { connectChat } from './chatStream.js';
import ChatMediaPicker from './ChatMediaPicker.jsx';
import ChatAdminActions from './ChatAdminActions.jsx';
import ChatHeartMessage from './ChatHeartMessage.jsx';
import useChatTimeout from './useChatTimeout.js';
import SavedQuestionPicker from './SavedQuestionPicker.jsx';
import { MentionPicker, useChatMentions } from './ChatMentions.jsx';
import { PinnedMessage, ReplyPreview, SharedContent } from './ChatMessageParts.jsx';
import { messageDraft } from './chatText.js';
import { rememberChatInvite } from './chatInvites.js';
import './ChatDiscord.css';

const timeLabel = (value) => new Intl.DateTimeFormat('mn-MN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const dayLabel = (value) => new Intl.DateTimeFormat('mn-MN', { month: 'long', day: 'numeric' }).format(new Date(value));

export default function Chat() {
  const [params, setParams] = useSearchParams();
  const roomId = params.get('room') || 'all';
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('messages');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connection, setConnection] = useState('connecting');
  const connectionRef = useRef('connecting');
  const [typing, setTyping] = useState({});
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [originalMessage, setOriginalMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [heartBusy, setHeartBusy] = useState(() => new Set());
  const heartRequests = useRef(new Set());
  const heartVersions = useRef(new Map());
  const loadedMessageIds = useRef(new Set());
  loadedMessageIds.current = new Set(messages.map((message) => message.id));
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [reportMessage, setReportMessage] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [people, setPeople] = useState([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [reports, setReports] = useState([]);
  const [newMessages, setNewMessages] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [questionPicker, setQuestionPicker] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(null);
  const [showMembers, setShowMembers] = useState(() => window.innerWidth >= 1280);
  const composerRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const shellRef = useRef(null);
  const attachmentRef = useRef(null);
  const attachmentButtonRef = useRef(null);
  const draftId = useRef(null);
  const typingActive = useRef(false);
  const typingAt = useRef(0);
  const typingTimer = useRef(null);
  const nearBottom = useRef(true);
  const requestVersion = useRef(0);
  const initializedMessages = useRef(false);
  const latestMessage = useRef(null);
  const currentRoom = useRef(roomId);
  currentRoom.current = roomId;
  const admin = data?.me.role === 'ADMIN';
  const premium = data?.me.premium || admin;
  const peer = data?.rooms.find((room) => room.id === roomId)?.peer;
  const pending = data?.invites.filter((invite) => invite.status === 'PENDING') || [];
  const incoming = pending.filter((invite) => !invite.outgoing).length;
  const hiddenIds = data?.hiddenIds || [];
  const timeout = useChatTimeout(data?.me.timeoutUntil);
  const cannotCompose = busy || loading || !data || timeout.active;
  const mention = useChatMentions({ value: draft, onChange: updateDraft, roomId, disabled: cannotCompose || section !== 'messages', composerRef });
  const visibleMentions = (message) => (message.mentions || []).filter((item) => !hiddenIds.includes(item.userId));
  const visibleReply = (reply) => reply?.author && hiddenIds.includes(reply.author.id) ? { id: reply.id, body: '', unavailable: true } : reply;

  const stopTyping = useCallback(() => {
    clearTimeout(typingTimer.current);
    typingAt.current = 0;
    if (!typingActive.current) return;
    typingActive.current = false;
    api(`/chat/rooms/${encodeURIComponent(roomId)}/typing`, { method: 'POST', body: { active: false } }).catch(() => {});
  }, [roomId]);

  const loadBootstrap = useCallback(async () => {
    const result = await api('/chat/bootstrap');
    setData(result);
    return result;
  }, []);

  const refreshHeart = useCallback(async (messageId) => {
    const version = (heartVersions.current.get(messageId) || 0) + 1;
    heartVersions.current.set(messageId, version);
    const result = await api(`/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`);
    if (currentRoom.current !== roomId || heartVersions.current.get(messageId) !== version) return;
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, ...result.message } : message));
  }, [roomId]);

  useEffect(() => {
    if (!timeout.active) return;
    stopTyping(); setMediaPicker(null); setAttachmentsOpen(false); setQuestionPicker(false);
  }, [timeout.active, stopTyping]);

  const loadMessages = useCallback(async (older = false) => {
    const version = ++requestVersion.current;
    const scroll = scrollRef.current;
    const height = scroll?.scrollHeight || 0;
    const before = older ? scroll?.dataset.oldest : null;
    const filters = new URLSearchParams(before ? { before } : {});
    try {
      const result = await api(`/chat/rooms/${encodeURIComponent(roomId)}/messages?${filters}`);
      if (version !== requestVersion.current) return;
      setMessages((current) => {
        const merged = new Map(current.map((message) => [message.id, message]));
        result.messages.forEach((message) => merged.set(message.id, message));
        return [...merged.values()].sort((first, second) => first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id));
      });
      if (older || !initializedMessages.current) setHasMore(result.hasMore);
      initializedMessages.current = true;
      const receivedNew = !older && latestMessage.current && result.messages.at(-1)?.id !== latestMessage.current;
      if (!older) latestMessage.current = result.messages.at(-1)?.id || null;
      setLoading(false);
      requestAnimationFrame(() => {
        if (older && scroll) scroll.scrollTop += scroll.scrollHeight - height;
        else if (nearBottom.current) bottomRef.current?.scrollIntoView({ block: 'nearest' });
        else if (receivedNew) setNewMessages(true);
      });
    } catch (failure) { if (version === requestVersion.current) { setError(failure.message); setLoading(false); } }
  }, [roomId]);

  useEffect(() => {
    let alive = true;
    loadBootstrap().catch((failure) => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [loadBootstrap]);

  useEffect(() => {
    if (!data?.me.id || loading || !initializedMessages.current) return;
    api('/chat/visit', { method: 'PUT' }).catch(() => {});
  }, [data?.me.id, loading]);

  useEffect(() => {
    setMessages([]); setLoading(true); setError(''); setTyping({}); setNewMessages(false); nearBottom.current = true;
    initializedMessages.current = false; latestMessage.current = null;
    loadMessages();
    return () => { requestVersion.current += 1; };
  }, [loadMessages]);

  useEffect(() => {
    if (!data || roomId === 'all' || data.rooms.some((room) => room.id === roomId)) return;
    let active = true;
    api('/chat/bootstrap').then((fresh) => {
      if (!active) return;
      setData(fresh);
      if (!fresh.rooms.some((room) => room.id === roomId)) { setParams({}); setSection('messages'); setNotice('Энэ хувийн чат одоогоор боломжгүй байна.'); }
    }).catch(() => { if (active) { setParams({}); setNotice('Хувийн чат ачаалж чадсангүй. Дахин оролдоно уу.'); } });
    return () => { active = false; };
  }, [data, roomId, setParams]);

  useEffect(() => {
    setDraft(''); draftId.current = null;
    setSection('messages'); setSelectedPerson(null);
    setReplyTo(null); setOriginalMessage(null);
    setMediaPicker(null); selectionRef.current = { start: 0, end: 0 };
    setAttachmentsOpen(false); setQuestionPicker(false);
    return stopTyping;
  }, [roomId, stopTyping]);

  useEffect(() => {
    if (section !== 'messages') stopTyping();
    if (section !== 'messages') { setMediaPicker(null); setAttachmentsOpen(false); setQuestionPicker(false); }
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') stopTyping(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [section, stopTyping]);

  useEffect(() => {
    let refreshTimer;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { loadMessages(); loadBootstrap().catch(() => {}); }, 250);
    };
    const stop = connectChat((event) => {
      if (event.type === 'deleted' && event.roomId === roomId) {
        setMessages((current) => current.map((message) => message.id === event.messageId ? { ...message, body: '', mentions: [], reply: null, system: null, heart: { count: 0, active: false }, deleted: true } : message.reply?.id === event.messageId ? { ...message, reply: { ...message.reply, body: '', deleted: true } } : message));
        setReplyTo((current) => current?.id === event.messageId ? null : current);
        setOriginalMessage((current) => current?.id === event.messageId ? { ...current, body: '', mentions: [], deleted: true } : current);
      }
      if (event.type === 'typing' && event.roomId === roomId) setTyping((current) => ({ ...current, [event.userId]: { until: event.active ? Date.now() + 4500 : 0 } }));
      if (event.type === 'reaction' && event.roomId === roomId && loadedMessageIds.current.has(event.messageId)) refreshHeart(event.messageId).catch(() => {});
      if (event.type === 'connected' || event.type === 'refresh' || event.type === 'deleted') refresh();
    }, (status) => { connectionRef.current = status; setConnection(status); });
    const reconcile = setInterval(() => {
      if (document.visibilityState === 'visible' && connectionRef.current !== 'live') refresh();
    }, 60000);
    const prune = setInterval(() => setTyping((current) => Object.fromEntries(Object.entries(current).filter(([, person]) => person.until > Date.now()))), 1000);
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { stop(); clearTimeout(refreshTimer); clearInterval(reconcile); clearInterval(prune); document.removeEventListener('visibilitychange', onFocus); };
  }, [loadMessages, loadBootstrap, refreshHeart, roomId]);

  useEffect(() => {
    const resize = () => shellRef.current?.style.setProperty('--chat-viewport', `${window.visualViewport?.height || window.innerHeight}px`);
    resize(); window.visualViewport?.addEventListener('resize', resize);
    return () => window.visualViewport?.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (section !== 'people' && !(showMembers && roomId === 'all')) return;
    let active = true;
    setListLoading(true);
    const timer = setTimeout(() => api('/chat/people?q=' + encodeURIComponent(peopleSearch)).then((result) => { if (active) setPeople(result.people); }).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setListLoading(false); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [section, peopleSearch, showMembers, roomId]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = 'auto';
    composer.style.height = Math.min(composer.scrollHeight, 132) + 'px';
  }, [draft, section]);

  useEffect(() => {
    if (section !== 'reports') return;
    setListLoading(true);
    api('/chat/reports').then((result) => setReports(result.reports)).catch((failure) => setError(failure.message)).finally(() => setListLoading(false));
  }, [section]);

  useEffect(() => {
    if (!attachmentsOpen) return;
    attachmentRef.current?.querySelector('button')?.focus();
    const onPointer = (event) => {
      if (!attachmentRef.current?.contains(event.target) && !attachmentButtonRef.current?.contains(event.target)) setAttachmentsOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') { setAttachmentsOpen(false); attachmentButtonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [attachmentsOpen]);

  function closeQuestionPicker() {
    setQuestionPicker(false);
    requestAnimationFrame(() => attachmentButtonRef.current?.focus());
  }

  useEffect(() => {
    if (roomId !== 'all' && section === 'messages' && !loading && document.visibilityState === 'visible') api(`/chat/rooms/${encodeURIComponent(roomId)}/read`, { method: 'POST' }).catch(() => {});
  }, [roomId, section, loading, messages.at(-1)?.id]);

  async function act(operation, success, onFailure) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { const result = await operation(); await loadBootstrap(); if (success) success(result); }
    catch (failure) { setError(failure.message); if (onFailure) await onFailure(failure); }
    finally { setBusy(false); }
  }
  function chooseRoom(id) { setParams(id === 'all' ? {} : { room: id }); setSection('messages'); setNotice(''); setPeopleSearch(''); }
  function rememberSelection() {
    const composer = composerRef.current;
    if (composer) selectionRef.current = { start: composer.selectionStart, end: composer.selectionEnd };
  }
  function closeMediaPicker() {
    setMediaPicker(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  function insertEmoji(emoji) {
    if (cannotCompose) return false;
    const start = Math.min(selectionRef.current.start, draft.length);
    const end = Math.min(selectionRef.current.end, draft.length);
    const updated = draft.slice(0, start) + emoji + draft.slice(end);
    if (updated.length > 2000) { setNotice('Мессеж 2000 тэмдэгтээс хэтрэхгүй байна.'); return false; }
    const caret = start + emoji.length;
    mention.change(updated, caret);
    selectionRef.current = { start: caret, end: caret };
    setMediaPicker(null);
    requestAnimationFrame(() => { composerRef.current?.focus(); composerRef.current?.setSelectionRange(caret, caret); });
    return true;
  }
  function updateDraft(value) {
    if (timeout.active) return;
    setDraft(value); draftId.current = null;
    clearTimeout(typingTimer.current);
    if (!value.trim()) { stopTyping(); return; }
    const sentAt = Date.now();
    if (!typingActive.current || sentAt - typingAt.current >= 2500) {
      typingActive.current = true;
      typingAt.current = sentAt;
      api(`/chat/rooms/${encodeURIComponent(roomId)}/typing`, { method: 'POST', body: { active: true } }).catch(() => {
        if (currentRoom.current === roomId && typingAt.current === sentAt) typingActive.current = false;
      });
    }
    typingTimer.current = setTimeout(stopTyping, 3000);
  }
  async function send(event) {
    event?.preventDefault();
    if (!draft.trim() || cannotCompose) return;
    stopTyping();
    const destination = roomId;
    const { body, mentions } = messageDraft(draft, mention.mentions);
    const clientId = draftId.current || crypto.randomUUID();
    draftId.current = clientId;
    await act(() => api(`/chat/rooms/${encodeURIComponent(destination)}/messages`, { method: 'POST', body: { body, clientId, mentions, replyToId: replyTo?.id } }), () => {
      if (currentRoom.current === destination) { setDraft(''); setReplyTo(null); mention.reset(); draftId.current = null; nearBottom.current = true; loadMessages(); }
    }, async (failure) => {
      if (failure.status !== 404 || destination === 'all') return;
      try {
        const fresh = await loadBootstrap();
        if (!fresh.rooms.some((room) => room.id === destination)) {
          setParams({});
          setNotice('Энэ хувийн чат олдохгүй байна. Нийтийн чат руу шилжлээ.');
        }
      } catch {}
    });
  }
  function startReply(message) {
    if (cannotCompose) return;
    setReplyTo(message); draftId.current = null;
    setMediaPicker(null); setAttachmentsOpen(false); mention.close();
    composerRef.current?.focus();
  }
  async function reactToMessage(message, active) {
    if (cannotCompose || message.deleted || message.system || heartRequests.current.has(message.id)) return false;
    if (active && message.heart?.active) return true;
    heartRequests.current.add(message.id);
    setHeartBusy(new Set(heartRequests.current));
    try {
      await api(`/chat/messages/${encodeURIComponent(message.id)}/heart`, { method: 'PUT', body: { active } });
      if (currentRoom.current === roomId) await refreshHeart(message.id);
      return true;
    } catch (failure) { setError(failure.message); return false; }
    finally { heartRequests.current.delete(message.id); setHeartBusy(new Set(heartRequests.current)); }
  }
  async function openReply(reply) {
    const destination = roomId;
    try {
      const result = await api(`/chat/rooms/${encodeURIComponent(destination)}/messages/${encodeURIComponent(reply.id)}`);
      if (currentRoom.current === destination) setOriginalMessage(result.message);
    } catch (failure) { if (currentRoom.current === destination) setNotice(failure.message); }
  }
  const isTyping = Object.entries(typing).some(([userId, person]) => userId !== data?.me.id && !hiddenIds.includes(userId) && person.until > Date.now());
  const visibleMessages = messages.filter((message) => !hiddenIds.includes(message.author.id));
  const personInvite = selectedPerson && data?.invites.find((invite) => invite.peer.id === selectedPerson.id);
  const personRoom = selectedPerson && data?.rooms.find((room) => room.peer.id === selectedPerson.id);
  function personUpdated(person) {
    setSelectedPerson((current) => current?.id === person.id ? person : current);
    setPeople((current) => current.map((item) => item.id === person.id ? person : item));
    loadBootstrap().catch((failure) => setError(failure.message));
    loadMessages();
  }
  async function invitePerson() {
    const result = await api('/chat/invites', { method: 'POST', body: { recipientId: selectedPerson.id } });
    rememberChatInvite(data.me.id, result.invite);
    return result;
  }

  return <div className="chat-page chat-workspace" ref={shellRef}>
    <header className="ch-page-heading"><div className="ch-page-identity"><Link className="ch-back" to={admin ? '/admin' : '/student'} aria-label="Нүүр рүү буцах"><ChatIcon name="arrow" size={21} /></Link><p className="ch-eyebrow">WORKAHEAD COMMUNITY <span className="ch-beta" aria-label="Beta хувилбар">BETA</span></p></div><Link className="ch-profile-link" to={admin ? '/admin/settings' : '/student/profile'}><Avatar person={data?.me} small /><PersonName person={data?.me} /></Link></header>
    <div className={'ch-shell' + (showMembers ? ' ch-shell--members' : '')}>
      <aside className="ch-sidebar" aria-label="Чатны цэс">
        <div className="ch-sidebar-title"><span className="ch-community-mark">W<span>·</span>A</span><div><strong>WorkAhead</strong><small>COMMUNITY</small></div><span className={'ch-status ch-status--' + connection} title={connection === 'live' ? 'Шууд холбогдсон' : 'Дахин холбогдож байна'} /></div>
        <div className="ch-channel-label">СУВГУУД</div>
        <div className="ch-nav">
          <div className="ch-nav-main"><button className={section === 'messages' && roomId === 'all' ? 'is-active' : ''} aria-label="GENERAL CHAT" onClick={() => chooseRoom('all')}><span className="ch-hash" aria-hidden="true">#</span><span>GENERAL CHAT</span></button><div className="ch-nav-tools">
            <button className={section === 'invites' ? 'is-active' : ''} aria-label="Урилгууд" title="Урилгууд" onClick={() => setSection('invites')}><ChatIcon name="mail" />{incoming > 0 && <b aria-label={`${incoming} шинэ урилга`}>{incoming}</b>}</button>
            <button className={section === 'people' ? 'is-active' : ''} aria-label="Хүмүүс" title="Хүмүүс" onClick={() => setSection('people')}><ChatIcon name="people" /></button>
          </div></div>
          {admin && <button className={section === 'reports' ? 'is-active' : ''} onClick={() => setSection('reports')}><ChatIcon name="flag" /><span>Мэдээлсэн</span></button>}
        </div>
        <div className="ch-direct-heading"><span>ХУВИЙН МЕССЕЖ</span><button type="button" aria-label="Хувийн чат эхлүүлэх" onClick={() => setSection('people')}><ChatIcon name="plus" size={16} /></button></div>
        <div className="ch-direct-list">{data?.rooms.map((room) => <button key={room.id} className={roomId === room.id && section === 'messages' ? 'is-active' : ''} onClick={() => chooseRoom(room.id)}><Avatar person={room.peer} small /><PersonName person={room.peer} />{room.unread && <i aria-label="Уншаагүй мессеж" />}</button>)}{data && !data.rooms.length && <p>Хүн сонгоод яриа эхлүүлээрэй.</p>}</div>
        <div className="ch-sidebar-account"><Avatar person={data?.me} small /><div><PersonName person={data?.me} /><small>{connection === 'live' ? 'Холбогдсон' : 'Холбогдож байна…'}</small></div><Link to={admin ? '/admin/settings' : '/student/profile'} aria-label="Chat профайл тохируулах"><ChatIcon name="settings" size={19} /></Link></div>
      </aside>
      <section className="ch-main" aria-label="Chat">
        <header className="ch-room-header">
          <span className="ch-room-icon">{section === 'messages' && roomId === 'all' ? <span className="ch-hash">#</span> : <ChatIcon name={section === 'messages' ? 'lock' : section === 'people' ? 'people' : section === 'reports' ? 'flag' : 'mail'} />}</span>
          <div className="ch-room-title"><h2>{section === 'messages' ? (roomId === 'all' ? 'GENERAL CHAT' : <PersonName person={peer} fallback="Хувийн чат" />) : section === 'people' ? 'Хамт суралцагчид' : section === 'reports' ? 'Мессежийн мэдээллүүд' : 'Чатны урилгууд'}</h2><p>{section === 'messages' ? (roomId === 'all' ? 'Бүх суралцагчдын нээлттэй орон зай' : 'Хамтдаа бод. Хамтдаа ярилц.') : 'WORKAHEAD COMMUNITY'}</p></div>
          {section === 'messages' && <div className="ch-room-tools">
            <button type="button" className={'ch-icon-button' + (showMembers ? ' is-active' : '')} aria-label="Оролцогчид" onClick={() => { if (window.innerWidth < 1100) setSection('people'); else setShowMembers(!showMembers); }}><ChatIcon name="people" size={20} /></button>
          </div>}
        </header>
        {error && <div className="ch-error" role="alert"><span>{error}</span><button onClick={() => { setError(''); loadBootstrap().catch((failure) => setError(failure.message)); loadMessages(); }}>Дахин оролдох</button></div>}
        {notice && <div className="ch-notice" role="status">{notice}<button aria-label="Мэдэгдэл хаах" onClick={() => setNotice('')}><ChatIcon name="close" size={14} /></button></div>}
        {section === 'messages' && <>
          {roomId === 'all' && data?.pinned && <PinnedMessage key={data.me.id + ':' + data.pinned.id} message={data.pinned} userId={data.me.id} admin={admin} busy={busy} onUnpin={() => act(() => api(`/chat/messages/${data.pinned.id}/pin`, { method: 'PUT', body: { pinned: false } }))} onDelete={() => setConfirmDelete(data.pinned)}><SharedContent body={data.pinned.body} mentions={visibleMentions(data.pinned)} meId={data.me.id} onPerson={setSelectedPerson} /></PinnedMessage>}
          <div className="ch-messages" ref={scrollRef} data-oldest={messages[0]?.id || ''} onScroll={(event) => { const element = event.currentTarget; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; if (nearBottom.current) setNewMessages(false); }}>
            {loading ? <div className="ch-empty" role="status"><ChatIcon name="chat" size={32} /><p>Яриа ачаалж байна…</p></div> : <>
              {hasMore && <button className="ch-load-more" onClick={() => loadMessages(true)}>Өмнөх мессежүүд</button>}
              {roomId === 'all' && !hasMore && <div className="ch-welcome"><span>#</span><h3># GENERAL CHAT-д тавтай морил!</h3><p>Бодлого, шалгалт, бэлтгэлийн талаар ярилцъя.<br />Бие биедээ хүндэтгэлтэй хандаарай.</p></div>}
              {!visibleMessages.length && <div className="ch-empty"><p>Эхний мэндчилгээгээ үлдээгээрэй.</p></div>}
              {visibleMessages.map((message, index) => {
                const previous = visibleMessages[index - 1];
                const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                const grouped = !newDay && !message.system && !previous.system && !message.reply && !message.deleted && !previous.deleted && previous.author.id === message.author.id && new Date(message.createdAt) - new Date(previous.createdAt) < 300000;
                return <div key={message.id}>
                  {newDay && <div className="ch-day"><span>{dayLabel(message.createdAt)}</span></div>}
                  <article data-message-id={message.id} className={'ch-message' + (message.system ? ' ch-message--system' : '') + (grouped ? ' ch-message--grouped' : '') + (visibleMentions(message).some((item) => item.userId === data?.me.id) ? ' ch-message--mentioned' : '')} aria-label={message.system ? 'Чатны эрхийн мэдэгдэл' : message.author.name + ' мессеж'}>
                    {grouped ? <time className="ch-group-time" dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time> : <button className="ch-avatar-button" aria-label={message.author.name + ' профайл'} onClick={() => setSelectedPerson(message.author)}><Avatar person={message.author} /></button>}
                    <ChatHeartMessage message={message} disabled={cannotCompose || message.deleted || Boolean(message.system)} busy={heartBusy.has(message.id)} onReact={reactToMessage}>{message.reply && <ReplyPreview message={visibleReply(message.reply)} onOpen={openReply} />}{!grouped && <div className="ch-message-meta"><button onClick={() => setSelectedPerson(message.author)}><PersonName person={message.author} /></button><Badges badges={message.author.badges} /><time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time></div>}{message.system && <span className="ch-system-label"><ChatIcon name={message.system.type === 'mute' ? 'lock' : 'check'} size={13} />Чатны эрхийн мэдэгдэл</span>}{message.deleted ? <p className="ch-deleted">Мессеж устгагдсан</p> : <SharedContent body={message.body} mentions={visibleMentions(message)} meId={data?.me.id} onPerson={setSelectedPerson} />}</ChatHeartMessage>
                    {!message.deleted && <div className="ch-message-actions">{!message.system && <button type="button" className={message.heart?.active ? 'ch-heart-action is-active' : 'ch-heart-action'} aria-label={message.heart?.active ? 'Зүрхээ буцаах' : 'Зүрх дарах'} title="Зүрх" aria-pressed={Boolean(message.heart?.active)} disabled={cannotCompose || heartBusy.has(message.id)} onClick={() => reactToMessage(message, !message.heart?.active)}><ChatIcon name="heart" size={17} /></button>}<button type="button" aria-label="Хариулах" title="Reply" disabled={cannotCompose} onClick={() => startReply(message)}><ChatIcon name="reply" size={17} /></button>{admin && roomId === 'all' && <button type="button" aria-label={data?.pinned?.id === message.id ? 'Pin хасах' : 'Мессеж pin хийх'} title={data?.pinned?.id === message.id ? 'Pin хасах' : 'Pin хийх'} aria-pressed={data?.pinned?.id === message.id} disabled={busy} onClick={() => act(() => api(`/chat/messages/${message.id}/pin`, { method: 'PUT', body: { pinned: data?.pinned?.id !== message.id } }))}><ChatIcon name="pin" size={17} /></button>}{message.author.id !== data?.me.id && <button aria-label="Мессеж мэдээлэх" title="Мэдээлэх" onClick={() => { setReportMessage(message); setReportReason(''); }}><ChatIcon name="flag" size={17} /></button>}{(message.author.id === data?.me.id || (admin && roomId === 'all')) && <button aria-label="Мессеж устгах" title="Устгах" onClick={() => setConfirmDelete(message)}><ChatIcon name="trash" size={17} /></button>}</div>}
                  </article>
                </div>;
              })}
            </>}
            <div ref={bottomRef} />
          </div>
          {newMessages && !(roomId === 'all' && data?.me.settings.muted) && <button className="ch-new-messages" onClick={() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }); setNewMessages(false); }}>Сүүлийн мессеж рүү ↓</button>}
          <div className="ch-composer-area">
            {timeout.active && <div className="ch-timeout-banner"><ChatIcon name="lock" size={17} /><div><strong>Chat mute идэвхтэй</strong><span> {timeout.label} үлдлээ · Чат унших, шалгалт өгөх боломжтой.</span></div></div>}
            {mention.open && <MentionPicker mention={mention} />}
            {attachmentsOpen && <div ref={attachmentRef} className="ch-attachment-menu" role="group" aria-label="Чатад нэмэх сонголтууд"><button type="button" onClick={() => { setAttachmentsOpen(false); setQuestionPicker(true); }}><ChatIcon name="book" size={20} /><span>Хадгалсан асуултууд<small>Асуултаа хамтдаа ярилцъя</small></span></button></div>}
            {mediaPicker && <ChatMediaPicker mode={mediaPicker} onModeChange={setMediaPicker} onSelect={insertEmoji} onClose={closeMediaPicker} />}
            <div className="ch-typing" role="status" aria-live="polite" aria-atomic="true">{isTyping && <span className="ch-typing-text" lang="en">typing<span className="ch-typing-dots"><i>.</i><i>.</i><i>.</i></span></span>}</div>
            {replyTo && <div className="ch-reply-draft"><span>Хариулах</span><ReplyPreview message={visibleReply(replyTo)} onOpen={openReply} /><button type="button" className="ch-icon-button" aria-label="Хариулт цуцлах" disabled={busy} onClick={() => { setReplyTo(null); draftId.current = null; composerRef.current?.focus(); }}><ChatIcon name="close" size={16} /></button></div>}
            <form className="ch-composer" onSubmit={send}>
              <button ref={attachmentButtonRef} type="button" className={'ch-compose-tool ch-add' + (attachmentsOpen ? ' is-active' : '')} aria-label="Чатад нэмэх" aria-expanded={attachmentsOpen} disabled={cannotCompose} onClick={() => { setMediaPicker(null); setAttachmentsOpen(!attachmentsOpen); }}><ChatIcon name="plus" size={23} /></button>
              <textarea ref={composerRef} aria-label="Мессеж" role="combobox" aria-autocomplete="list" aria-expanded={mention.open} aria-controls={mention.open ? mention.listId : undefined} aria-activedescendant={mention.open && mention.people[mention.index] ? `${mention.listId}-${mention.index}` : undefined} maxLength={2000} rows={1} value={draft} disabled={cannotCompose} onSelect={(event) => { rememberSelection(); mention.onSelect(event.target); }} onChange={(event) => { mention.change(event.target.value, event.target.selectionStart, event.target.selectionEnd); rememberSelection(); }} onBlur={stopTyping} onKeyDown={(event) => { if (mention.onKeyDown(event)) return; if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } else if (event.key === 'Escape' && replyTo) { setReplyTo(null); draftId.current = null; } }} />
              <div className="ch-composer-tools">
                <button type="button" data-chat-media className={'ch-compose-tool' + (mediaPicker ? ' is-active' : '')} aria-label="Emoji ба GIF сонгох" aria-expanded={Boolean(mediaPicker)} disabled={cannotCompose} onMouseDown={(event) => event.preventDefault()} onClick={() => { setAttachmentsOpen(false); setMediaPicker(mediaPicker ? null : 'emoji'); }}><ChatIcon name="smile" size={23} /></button>
                <button type="submit" className="ch-send" disabled={cannotCompose || !draft.trim()} aria-label="Илгээх"><ChatIcon name="send" size={19} /></button>
              </div>
            </form>
            <div className="ch-composer-hint"><span><kbd>Enter</kbd> илгээх · <kbd>Shift + Enter</kbd> шинэ мөр</span>{draft.length > 1800 && <span>{draft.length}/2000</span>}</div>
          </div>
        </>}
        {section === 'invites' && <div className="ch-list-panel"><p className="ch-subtle">Зөвшөөрсний дараа хувийн чат нээгдэнэ. Багцгүй хүн ч ирсэн урилгыг хүлээн авч ярилцаж болно.</p>{!pending.length && <div className="ch-empty"><ChatIcon name="mail" size={38} /><h3>Шинэ урилга алга</h3><p>Хүмүүс хэсгээс хамт бэлдэх хүнээ олоорой.</p></div>}{pending.map((invite) => <article className="ch-person-row" key={invite.id}><Avatar person={invite.peer} /><div><strong><PersonName person={invite.peer} /></strong><Badges badges={invite.peer.badges} /><small>{invite.outgoing ? 'Таны илгээсэн урилга' : 'Таныг хувийн чатад урьсан'}</small></div><div className="ch-row-actions">{(invite.outgoing ? [['cancel', 'Цуцлах']] : [['accept', 'Зөвшөөрөх'], ['decline', 'Татгалзах']]).map(([action, label]) => <button key={action} disabled={busy} className={action === 'accept' ? 'ch-primary' : 'ch-secondary'} onClick={() => act(() => api('/chat/invites/' + invite.id, { method: 'PUT', body: { action } }), (result) => { if (result.invite.roomId) chooseRoom(result.invite.roomId); })}>{label}</button>)}</div></article>)}</div>}
        {section === 'people' && <div className="ch-list-panel"><label className="ch-search"><ChatIcon name="search" size={17} /><input aria-label="Хүн хайх" placeholder="Нэрээр хайх…" maxLength={80} value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} /></label><p className="ch-subtle">Профайлыг нээж badge үзэх эсвэл хувийн чатад уриарай.</p>{listLoading ? <p role="status">Хайж байна…</p> : people.filter((person) => !hiddenIds.includes(person.id)).map((person) => <button className="ch-person-row ch-person-button" key={person.id} onClick={() => setSelectedPerson(person)}><Avatar person={person} /><div><strong><PersonName person={person} /></strong><Badges badges={person.badges} /></div><span>→</span></button>)}{!listLoading && !people.length && <p>Хэрэглэгч олдсонгүй.</p>}</div>}
        {section === 'reports' && admin && <div className="ch-list-panel"><p className="ch-subtle">Хувийн ярианаас зөвхөн мэдээлсэн мессеж харагдана.</p>{listLoading ? <p role="status">Ачаалж байна…</p> : reports.map((report) => <article className="ch-report-card" key={report.id}><strong><PersonName person={report.author} /></strong><blockquote>{report.message.body || 'Устгасан мессеж'}</blockquote><p>{report.reason}</p><small>Мэдээлсэн: <PersonName person={report.reporter} /></small><div className="ch-row-actions"><button disabled={busy} className="ch-secondary" onClick={() => act(() => api('/chat/reports/' + report.id, { method: 'PUT' }), () => setReports((current) => current.filter((item) => item.id !== report.id)))}>Шийдвэрлэсэн</button><button className="ch-secondary" onClick={() => setConfirmDelete(report.message)}>Мессеж устгах</button></div></article>)}{!listLoading && !reports.length && <div className="ch-empty">Шийдвэрлэх мэдээлэл алга.</div>}</div>}
      </section>
      {showMembers && <aside className="ch-members" aria-label="Ярианы оролцогчид"><header><h3>{roomId === 'all' ? 'ХАМТ СУРАЛЦАГЧИД' : 'ЭНЭ ЯРИАНД'}</h3><button type="button" className="ch-icon-button" aria-label="Оролцогчдыг нуух" onClick={() => setShowMembers(false)}><ChatIcon name="close" size={16} /></button></header><div className="ch-member-list">{(roomId === 'all' ? [data?.me, ...people] : [data?.me, peer]).filter((person) => person && !hiddenIds.includes(person.id)).map((person) => <button className="ch-member" key={person.id} onClick={() => setSelectedPerson(person)}><Avatar person={person} small /><div><strong><PersonName person={person} /></strong><Badges badges={person.badges} /></div></button>)}{listLoading && <p className="ch-subtle">Ачаалж байна…</p>}</div><p className="ch-members-note">Профайлыг нь нээгээд<br />хамт бэлдэх хүнээ олоорой.</p></aside>}
    </div>
    {selectedPerson && <ChatDialog title="Chat профайл" onClose={() => setSelectedPerson(null)}><div className="ch-person-card"><Avatar person={selectedPerson} /><h3><PersonName person={selectedPerson} /></h3><Badges badges={selectedPerson.badges} /></div>{selectedPerson.id !== data?.me.id && <div className="ch-dialog-actions">{personRoom ? <button className="ch-primary" onClick={() => { chooseRoom(personRoom.id); setSelectedPerson(null); }}>Хувийн чат нээх</button> : personInvite?.status === 'PENDING' ? <button className="ch-primary" onClick={() => { setSection('invites'); setSelectedPerson(null); }}>Урилга харах</button> : premium ? <button disabled={busy || timeout.active} className="ch-primary" onClick={() => act(invitePerson, () => { setSelectedPerson(null); setNotice('Хүсэлт илгээгдлээ. Нөгөө хүн зөвшөөрөхөд хувийн чат нээгдэнэ.'); })}><ChatIcon name="mail" size={17} />Хувийн чатны хүсэлт илгээх</button> : <Link className="ch-primary" to="/student/payment">Урилга илгээх багц авах</Link>}<button disabled={busy} className="ch-secondary" onClick={() => act(() => api('/chat/blocks/' + selectedPerson.id, { method: 'PUT', body: { blocked: true } }), () => { setSelectedPerson(null); chooseRoom('all'); setNotice('Блоклолоо. Профайлаас буцааж нээж болно.'); })}>Блоклох</button>{error && <p className="ch-error" role="alert">{error}</p>}</div>}{admin && selectedPerson.role === 'STUDENT' && <ChatAdminActions key={selectedPerson.id} person={selectedPerson} onUpdated={personUpdated} />}</ChatDialog>}
    {confirmDelete && <ChatDialog title="Мессеж устгах уу?" onClose={() => setConfirmDelete(null)}><p>Мессежийн агуулга ярианаас арилна. Энэ үйлдлийг буцаах боломжгүй.</p><div className="ch-dialog-actions"><button className="ch-primary" disabled={busy} onClick={() => act(() => api('/chat/messages/' + confirmDelete.id, { method: 'DELETE' }), () => { setReports((current) => current.filter((report) => report.message.id !== confirmDelete.id)); setConfirmDelete(null); loadMessages(); })}>Устгах</button><button className="ch-secondary" onClick={() => setConfirmDelete(null)}>Болих</button>{error && <p role="alert">{error}</p>}</div></ChatDialog>}
    {questionPicker && <SavedQuestionPicker key={roomId} roomId={roomId} replyToId={replyTo?.id} onClose={closeQuestionPicker} onShared={() => { closeQuestionPicker(); setReplyTo(null); draftId.current = null; nearBottom.current = true; loadMessages(); }} />}
    {originalMessage && <ChatDialog title="Эх мессеж" onClose={() => setOriginalMessage(null)}><div className="ch-original-message">{hiddenIds.includes(originalMessage.author.id) ? <p>Эх мессеж боломжгүй байна.</p> : <><strong><PersonName person={originalMessage.author} /></strong>{originalMessage.deleted ? <p className="ch-deleted">Мессеж устгагдсан</p> : <SharedContent body={originalMessage.body} mentions={visibleMentions(originalMessage)} meId={data?.me.id} onPerson={(person) => { setOriginalMessage(null); setSelectedPerson(person); }} />}</>}</div></ChatDialog>}
    {reportMessage && <ChatDialog title="Мессеж мэдээлэх" onClose={() => setReportMessage(null)}><p>Зөвхөн энэ мессеж болон тайлбар админд харагдана.</p><form onSubmit={(event) => { event.preventDefault(); act(() => api('/chat/messages/' + reportMessage.id + '/report', { method: 'POST', body: { reason: reportReason } }), () => { setReportMessage(null); setNotice('Мэдээллийг админд илгээлээ.'); }); }}><label className="ch-report-label">Шалтгаан<textarea required minLength={3} maxLength={300} value={reportReason} onChange={(event) => setReportReason(event.target.value)} /></label><button className="ch-primary" disabled={busy}>Мэдээлэх</button>{error && <p role="alert">{error}</p>}</form></ChatDialog>}
  </div>;
}
