import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

// Зөвхөн баталгаат мэргэжлүүдийг (МТЭС/БС/ХЗС/ШУС/ИТС/УТСОУХНУС) жагсаалтад үлдээнэ
const VALID_SCHOOLS = ['МТЭС', 'БС', 'ХЗС', 'ШУС', 'ИТС', 'УТСОУХНУС'];
const majorsOf = (list) => list.filter((p) => VALID_SCHOOLS.includes(p.school));

export default function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [adding, setAdding] = useState(false);
  const [gifting, setGifting] = useState(null);
  const { user: me } = useAuth();
  const toast = useToast();
  const majorPrograms = majorsOf(programs);

  const load = () => api('/admin/users').then((d) => setUsers(d.users)).catch((e) => toast(e.message));

  useEffect(() => {
    load();
    api('/admin/catalog/universities')
      .then((d) => setPrograms(d.universities.flatMap((u) => u.programs.map((p) => ({ ...p, university: u.name })))))
      .catch(() => {});
    api('/admin/plans').then((d) => setPlans(d.plans)).catch(() => {});
  }, []);

  const toggleRole = async (u) => {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PUT', body: { role: u.role === 'ADMIN' ? 'STUDENT' : 'ADMIN' } });
      toast('Эрх солилоо'); load();
    } catch (e) { toast(e.message); }
  };

  const setProgram = async (u, programId) => {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PUT', body: { programId } });
      toast('Хөтөлбөр хадгаллаа'); load();
    } catch (e) { toast(e.message); }
  };

  const del = (u) => {
    if (!confirm(`${u.name} устгах уу?`)) return;
    api(`/admin/users/${u.id}`, { method: 'DELETE' }).then(() => { toast('Устгалаа'); load(); }).catch((e) => toast(e.message));
  };

  const gift = async (userId, planId) => {
    try {
      await api(`/admin/users/${userId}/gift`, { method: 'POST', body: { planId } });
      toast('Эрх giftлэгдлээ (30 хоног)');
      load();
      setGifting(null);
    } catch (e) { toast(e.message); }
  };
  const revoke = async (u) => {
    if (!confirm(`${u.name} gift эрхийг цуцлах уу?`)) return;
    try {
      await api(`/admin/users/${u.id}/revoke`, { method: 'POST' });
      toast('Gift цуцлагдлаа');
      load();
    } catch (e) { toast(e.message); }
  };

  return (
    <>
      <div className="page-title-row">
        <h1>Хэрэглэгчийн удирдлага</h1>
        <button className="btn small" onClick={() => setAdding(true)}>+ Хэрэглэгч</button>
      </div>

      {!users ? <Spinner /> : (
        <div className="card">
          {users.map((u) => {
            const sub = u.subscription;
            const daysLeft = sub?.expiresAt ? Math.max(0, Math.ceil((new Date(sub.expiresAt) - new Date()) / 86400000)) : null;
            return (
              <div key={u.id} className="row-link" style={{ flexWrap: 'wrap' }}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <strong>{u.name}</strong>{u.id === me.id && <span className="badge blue" style={{ marginLeft: 6 }}>ТА</span>}
                  {sub ? (
                    <span className={`badge ${sub.isGift ? 'blue' : 'ok'}`} style={{ marginLeft: 6 }}>
                      {sub.isGift ? `Gift • ${daysLeft !== null ? daysLeft + ' хоног' : ''}` : `Төлбөрт • ${daysLeft !== null ? daysLeft + ' хоног' : ''}`}
                    </span>
                  ) : (
                    <span className="badge" style={{ marginLeft: 6 }}>Эрхгүй</span>
                  )}
                  <span className="small muted" style={{ display: 'block' }}>
                    {u.email} · {u._count.attempts} тест · {u._count.flags} flag
                    {sub && <span> · {sub.title} {sub.expiresAt ? `· дуусах: ${new Date(sub.expiresAt).toLocaleDateString('mn-MN')}` : ''}</span>}
                  </span>
                  {u.program && (
                    <span className="badge blue" style={{ marginTop: 4, display: 'inline-block' }}>
                      {u.program.school ? `${u.program.school} · ` : ''}{u.program.name}
                    </span>
                  )}
                </span>
                <span className="btn-row" style={{ flexWrap: 'wrap' }}>
                  <select value={u.program?.id || ''} onChange={(e) => setProgram(u, e.target.value)}
                    style={{ width: 'auto', fontSize: '.78rem', padding: '4px 6px', maxWidth: 180 }}>
                    <option value="">Мэргэжилгүй</option>
                    {majorPrograms.map((p) => <option key={p.id} value={p.id}>{p.school ? `${p.school} · ` : ''}{p.name}</option>)}
                  </select>
                  {!sub ? (
                    <button className="btn secondary small" onClick={() => setGifting(u)}>Gift 30х</button>
                  ) : sub.isGift ? (
                    <button className="btn ghost-danger small" onClick={() => revoke(u)}>Gift цуцлах</button>
                  ) : (
                    <span className="small faint" style={{ padding: '4px 6px' }}>Төлбөрт</span>
                  )}
                  <button className={`btn small ${u.role === 'ADMIN' ? '' : 'secondary'}`} onClick={() => toggleRole(u)}>
                    {u.role === 'ADMIN' ? 'Админ' : 'Оюутан'}
                  </button>
                  {u.id !== me.id && (
                    <button className="btn ghost-danger small" onClick={() => del(u)}>Устгах</button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {adding && <AddUserModal programs={programs} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {gifting && <GiftModal user={gifting} plans={plans} onClose={() => setGifting(null)} onGift={gift} />}
    </>
  );
}

function GiftModal({ user, plans, onClose, onGift }) {
  const [planId, setPlanId] = useState(plans[0]?.id || '');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Gift эрх олгох — {user.name}</h3>
        <p className="small muted">{user.email}</p>
        <label>Багц</label>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.title} — {new Intl.NumberFormat('mn-MN').format(p.priceMnt)}₮ / {p.durationDays} хоног</option>)}
        </select>
        <p className="small faint" style={{ marginTop: 10 }}>30 хоногийн эрх giftлэгдэх ба төлбөрт тооцогдохгүй, статистикт орохгүй. Идэвхтэй эрх байвал хугацаа сунгагдана.</p>
        <div className="btn-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" onClick={() => onGift(user.id, planId)}>Gift олгох</button>
        </div>
      </div>
    </div>
  );
}

function AddUserModal({ programs, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STUDENT', programId: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const majorPrograms = majorsOf(programs);

  const save = async () => {
    setBusy(true);
    try {
      await api('/admin/users', { method: 'POST', body: form });
      toast('Хэрэглэгч нэмлээ');
      onSaved();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Шинэ хэрэглэгч</h3>
        <label>Нэр *</label><input value={form.name} onChange={set('name')} />
        <label>Имэйл *</label><input type="email" value={form.email} onChange={set('email')} />
        <label>Нууц үг *</label><input type="password" value={form.password} onChange={set('password')} />
        <label>Эрх</label>
        <select value={form.role} onChange={set('role')}>
          <option value="STUDENT">Оюутан</option><option value="ADMIN">Админ</option>
        </select>
        <label>Хөтөлбөр</label>
        <select value={form.programId} onChange={set('programId')}>
          <option value="">— Сонгохгүй —</option>
          {majorPrograms.length > 0 ? majorPrograms.map((p) => (
            <option key={p.id} value={p.id}>{p.university !== 'Монголын Их Сургууль' ? `${p.university} · ` : ''}{p.school ? `${p.school} · ` : ''}{p.name}</option>
          )) : programs.map((p) => (
            <option key={p.id} value={p.id}>{p.university} · {p.name}</option>
          ))}
        </select>
        <div className="btn-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.name || !form.email || !form.password} onClick={save}>
            {busy ? '…' : 'Нэмэх'}
          </button>
        </div>
      </div>
    </div>
  );
}
