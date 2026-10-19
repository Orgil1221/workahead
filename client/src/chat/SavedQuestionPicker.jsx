import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { ChatDialog, ChatIcon } from './ChatUI.jsx';
import QuestionCard from './QuestionCard.jsx';

export default function SavedQuestionPicker({ roomId, replyToId, onClose, onShared }) {
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const sendLock = useRef(false);
  const pending = useRef(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; version.current += 1; }; }, []);

  const load = useCallback(async (before = null) => {
    const request = ++version.current;
    setLoading(true); setError('');
    try {
      const filters = new URLSearchParams({ room: roomId, q: search.trim(), ...(before ? { before } : {}) });
      const result = await api('/chat/questions?' + filters);
      if (request !== version.current) return;
      setQuestions((current) => before ? [...current, ...result.questions] : result.questions);
      setNextCursor(result.nextCursor);
    } catch (failure) { if (request === version.current) setError(failure.message); }
    finally { if (request === version.current) setLoading(false); }
  }, [roomId, search]);

  useEffect(() => {
    setQuestions([]); setNextCursor(null); setLoading(true); setError('');
    const timer = setTimeout(() => load(), 200);
    return () => { clearTimeout(timer); version.current += 1; };
  }, [load, retry]);

  async function share(question) {
    if (sendLock.current) return;
    sendLock.current = true;
    setSending(question.id); setError('');
    if (pending.current?.questionId !== question.id || pending.current?.replyToId !== replyToId) pending.current = { questionId: question.id, clientId: crypto.randomUUID(), replyToId };
    try {
      await api(`/chat/rooms/${encodeURIComponent(roomId)}/questions`, { method: 'POST', body: pending.current });
      if (alive.current) onShared();
    } catch (failure) { if (alive.current) setError(failure.message); }
    finally { sendLock.current = false; if (alive.current) setSending(null); }
  }

  return <ChatDialog title="Хадгалсан асуултууд" onClose={onClose}>
    <p className="ch-subtle">Шалгалт өгөхдөө хадгалсан асуултаасаа сонгоод энэ чатад хуваалцаарай. Зөв хариу, бодолт нь орохгүй.</p>
    <label className="ch-question-search">Хадгалсан асуултаас хайх<input autoFocus type="search" value={search} maxLength={100} disabled={Boolean(sending)} onChange={(event) => setSearch(event.target.value)} placeholder="Шалгалт, сэдэв, асуулт…" /></label>
    {error && <div className="ch-error" role="alert">{error}<button type="button" disabled={Boolean(sending)} onClick={() => setRetry((current) => current + 1)}>Дахин ачаалах</button></div>}
    <div className="ch-question-list" aria-busy={loading}>
      {questions.map((question) => <QuestionCard question={question} key={question.id}><button type="button" disabled={Boolean(sending) || loading} className="ch-primary" onClick={() => share(question)}><ChatIcon name="send" size={16} />{sending === question.id ? 'Оруулж байна…' : 'Чатад оруулах'}</button></QuestionCard>)}
      {loading && <p className="ch-subtle" role="status">Асуултуудыг ачаалж байна…</p>}
      {!loading && !error && !questions.length && <div className="ch-saved-empty"><ChatIcon name="book" size={30} /><h3>{search.trim() ? 'Тохирох асуулт алга' : 'Хадгалсан асуулт алга'}</h3><p>{search.trim() ? 'Өөр түлхүүр үгээр хайгаарай.' : 'Шалгалтын асуултын дэргэдэх хадгалах тэмдэг дээр дарахад энд нэмэгдэнэ.'}</p></div>}
      {nextCursor && <button type="button" className="ch-secondary" disabled={loading || Boolean(sending)} onClick={() => load(nextCursor)}>Дараагийн асуултууд</button>}
    </div>
  </ChatDialog>;
}
