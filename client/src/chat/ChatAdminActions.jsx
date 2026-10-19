import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { ChatIcon } from './ChatUI.jsx';
import useChatTimeout from './useChatTimeout.js';

const durations = [[30, '30 минут'], [60, '1 цаг'], [180, '3 цаг']];

export default function ChatAdminActions({ person, onUpdated }) {
  const [current, setCurrent] = useState(null);
  const [action, setAction] = useState(null);
  const [minutes, setMinutes] = useState(30);
  const [plans, setPlans] = useState(null);
  const [planId, setPlanId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const timeout = useChatTimeout(current?.timeoutUntil);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    api(`/chat/people/${encodeURIComponent(person.id)}/moderation`).then((result) => { if (active) setCurrent(result.person); }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [person.id, revision]);
  useEffect(() => {
    if (action !== 'gift') return undefined;
    let active = true;
    api('/admin/plans').then((result) => {
      if (!active) return;
      const available = result.plans.filter((plan) => plan.active);
      setPlans(available); setPlanId((selected) => available.some((plan) => plan.id === selected) ? selected : available[0]?.id || '');
    }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [action, revision]);
  function choose(next) {
    setAction(next); setError(''); setNotice(''); request.current = null;
  }
  async function confirm(event) {
    event.preventDefault();
    if (locked.current || !action || !current || (action === 'gift' && !planId)) return;
    const key = `${action}:${action === 'gift' ? planId : minutes}`;
    if (request.current?.key !== key) request.current = { key, clientId: crypto.randomUUID() };
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await api(`/chat/people/${encodeURIComponent(person.id)}/${action === 'gift' ? 'gift' : 'timeout'}`, { method: 'POST', body: { clientId: request.current.clientId, ...(action === 'gift' ? { planId } : { action, ...(action === 'mute' ? { minutes } : {}) }) } });
      if (!alive.current) return;
      setCurrent(result.person); setAction(null); request.current = null;
      setNotice(action === 'gift' ? `30 хоногийн эрх бэлэглэлээ. Дуусах: ${new Date(result.expiresAt).toLocaleDateString('mn-MN')}.` : action === 'mute' ? 'Mute идэвхжлээ. Нийтийн чатад мэдэгдэл илгээгдлээ.' : 'Mute цуцлагдлаа.');
      onUpdated(result.person);
    } catch (failure) { if (alive.current) { setError(failure.message); setRevision((value) => value + 1); } }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="ch-admin-actions" aria-label="Админы үйлдлүүд">
    <h3><ChatIcon name="badge" size={17} /> Админы үйлдлүүд</h3>
    {!current && !error && <p role="status">Эрхийн төлөв шалгаж байна…</p>}
    {timeout.active && <p className="ch-timeout-status">Mute идэвхтэй · {timeout.label} үлдлээ</p>}
    {!action ? <div className="ch-dialog-actions"><button type="button" className="ch-secondary" disabled={!current} onClick={() => choose(timeout.active ? 'unmute' : 'mute')}><ChatIcon name="lock" size={16} />{timeout.active ? 'Unmute' : 'Mute'}</button><button type="button" className="ch-secondary" disabled={!current} onClick={() => choose('gift')}><ChatIcon name="gift" size={16} />Сарын эрх бэлэглэх</button></div> : <form onSubmit={confirm}><fieldset disabled={busy}>
      {action === 'mute' && <><legend>Mute хугацаа</legend><div className="ch-timeout-options">{durations.map(([value, label]) => <label key={value}><input type="radio" name="mute-duration" value={value} checked={minutes === value} onChange={() => setMinutes(value)} /><span>{label}</span></label>)}</div><p><strong>@{person.name}</strong> {durations.find(([value]) => value === minutes)[1]} нийтийн болон хувийн чатад бичих, урилга илгээх боломжгүй болно. Шалгалт өгөх эрх хэвээр үлдэнэ.</p></>}
      {action === 'unmute' && <><legend>Mute цуцлах</legend><p><strong>@{person.name}</strong> дахин чат бичих боломжтой болно.</p></>}
      {action === 'gift' && <><legend>30 хоногийн эрх бэлэглэх</legend>{plans === null ? <p role="status">Багцууд ачаалж байна…</p> : plans.length ? <label className="ch-gift-plan">Багц<select value={planId} onChange={(event) => setPlanId(event.target.value)}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label> : <p>Идэвхтэй багц алга.</p>}<p><strong>@{person.name}</strong>-д төлбөргүй 30 хоногийн эрх олгоно. Идэвхтэй эрхтэй бол хугацаан дээр нь нэмэгдэнэ.</p></>}
      <div className="ch-dialog-actions"><button className="ch-primary" disabled={busy || (action === 'gift' && !planId) || (action === 'unmute' && !timeout.active)}>{busy ? 'Хадгалж байна…' : action === 'gift' ? 'Бэлэглэхийг баталгаажуулах' : action === 'mute' ? 'Mute баталгаажуулах' : 'Unmute баталгаажуулах'}</button><button type="button" className="ch-secondary" onClick={() => choose(null)}>Болих</button></div>
    </fieldset></form>}
    {error && <div className="ch-error" role="alert"><span>{error}</span><button type="button" disabled={busy} onClick={() => { setError(''); setRevision((value) => value + 1); }}>Дахин шалгах</button></div>}
    {notice && <p className="ch-admin-success" role="status">{notice}</p>}
  </section>;
}
