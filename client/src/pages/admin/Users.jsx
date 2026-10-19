import { useEffect, useState } from 'react';
import { useAdminApi, useAdminUser } from './AdminContext.jsx';
import { AdminDialog, AdminHeading, AdminIcon, AdminEmpty, AdminError } from './AdminUI.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminUsers() {
  const api = useAdminApi();
  const [users, setUsers] = useState(null);
  const [academicPrograms, setAcademicPrograms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [adding, setAdding] = useState(false);
  const [gifting, setGifting] = useState(null);
  const me = useAdminUser();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [error, setError] = useState(null);
  const toast = useToast();

  const load = () => { setError(null); return api('/admin/users').then((data) => setUsers(data.users)).catch(setError); };
  const visibleUsers = (users || []).filter((user) => (role === 'ALL' || user.role === role) && [user.name, user.email, user.academicProgram?.name, user.academicProgram?.school, user.academicProgram?.university, user.program?.name, user.program?.school].filter(Boolean).join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useEffect(() => {
    load();
    api('/admin/academic-programs').then((d) => setAcademicPrograms(d.programs)).catch(() => {});
    api('/admin/plans').then((d) => setPlans(d.plans)).catch(() => {});
  }, []);

  const toggleRole = async (u) => {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PUT', body: { role: u.role === 'ADMIN' ? 'STUDENT' : 'ADMIN' } });
      toast('Эрх солилоо'); load();
    } catch (e) { toast(e.message); }
  };

  const setAcademicProgram = async (u, academicProgramId) => {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PUT', body: { academicProgramId } });
      toast('Мэргэжил хадгаллаа'); load();
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
      <AdminHeading eyebrow="ОЮУТНЫ УДИРДЛАГА" title="Хэрэглэгчид" description="Бүртгэл, суралцах эрх, мэргэжлийн мэдээллийг нэг дор удирд."><button className="btn small" onClick={() => setAdding(true)}><AdminIcon name="users" size={17} />Хэрэглэгч нэмэх</button></AdminHeading>
      <div className="filter-bar ad-user-filters"><div className="ad-user-search"><AdminIcon name="search" size={18} /><input aria-label="Хэрэглэгч хайх" placeholder="Нэр, имэйл, мэргэжлээр хайх…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Хэрэглэгчийн эрхээр шүүх" value={role} onChange={(event) => setRole(event.target.value)}><option value="ALL">Бүх эрх</option><option value="STUDENT">Оюутан</option><option value="ADMIN">Админ</option></select></div>
      {users && <div className="ad-users-summary"><span>Харагдаж буй <strong>{visibleUsers.length} / {users.length}</strong></span><span>Оюутан<strong>{users.filter((user) => user.role === 'STUDENT').length}</strong></span><span>Админ<strong>{users.filter((user) => user.role === 'ADMIN').length}</strong></span></div>}
      {error && <AdminError error={error} retry={load} />}

      {!users ? !error && <Spinner /> : !visibleUsers.length ? <div className="card"><AdminEmpty title={users.length ? "Хэрэглэгч олдсонгүй" : "Хэрэглэгч бүртгэгдээгүй байна"} icon="users">Хайлтын үг болон эрхийн шүүлтүүрээ өөрчилж үзээрэй.</AdminEmpty></div> : (
        <div className="card">
          {visibleUsers.map((u) => {
            const sub = u.subscription;
            const major = u.academicProgram || u.program;
            const daysLeft = sub?.expiresAt ? Math.max(0, Math.ceil((new Date(sub.expiresAt) - new Date()) / 86400000)) : null;
            return (
              <div key={u.id} className="row-link ad-user-row">
                <div className="ad-user-info"><span className="ad-avatar">{u.name.slice(0, 1)}</span><div>
                  <strong>{u.name}</strong>{u.id === me?.id && <span className="badge blue" style={{ marginLeft: 6 }}>ТА</span>}
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
                  {major && (
                    <span className="badge blue" style={{ marginTop: 4, display: 'inline-block' }}>
                      {major.school ? `${major.school} · ` : ''}{major.name}
                    </span>
                  )}
                </div></div>
                <span className="btn-row ad-user-actions">
                  <select aria-label={u.name + ' — мэргэжил'} value={u.academicProgram?.id || ''} onChange={(e) => setAcademicProgram(u, e.target.value)}
                    style={{ width: 'auto', fontSize: '.78rem', padding: '4px 6px', maxWidth: 180 }}>
                    <option value="">Мэргэжилгүй</option>
                    {academicPrograms.map((p) => <option key={p.id} value={p.id}>{p.university && p.university !== 'МУИС' ? `${p.university} · ` : ''}{p.school ? `${p.school} · ` : ''}{p.name}</option>)}
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
                  {u.id !== me?.id && (
                    <button className="btn ghost-danger small" onClick={() => del(u)}>Устгах</button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {adding && <AddUserModal academicPrograms={academicPrograms} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {gifting && <GiftModal user={gifting} plans={plans} onClose={() => setGifting(null)} onGift={gift} />}
    </>
  );
}

function GiftModal({ user, plans, onClose, onGift }) {
  const [planId, setPlanId] = useState(plans[0]?.id || '');
  return (
    <AdminDialog title={<>Gift эрх олгох — {user.name}</>} onClose={onClose}>
        <p className="small muted">{user.email}</p>
        <label htmlFor="admin-users-field-1">Багц</label>
        <select id="admin-users-field-1" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.title} — {new Intl.NumberFormat('mn-MN').format(p.priceMnt)}₮ / {p.durationDays} хоног</option>)}
        </select>
        <p className="small faint" style={{ marginTop: 10 }}>30 хоногийн эрх giftлэгдэх ба төлбөрт тооцогдохгүй, статистикт орохгүй. Идэвхтэй эрх байвал хугацаа сунгагдана.</p>
        <div className="btn-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" onClick={() => onGift(user.id, planId)}>Gift олгох</button>
        </div>
    </AdminDialog>
  );
}

function AddUserModal({ academicPrograms, onClose, onSaved }) {
  const api = useAdminApi();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STUDENT', academicProgramId: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
    <AdminDialog title={<>Шинэ хэрэглэгч</>} onClose={onClose} busy={busy}>
        <label htmlFor="admin-users-field-2">Нэр *</label><input id="admin-users-field-2" value={form.name} onChange={set('name')} />
        <label htmlFor="admin-users-field-3">Имэйл *</label><input id="admin-users-field-3" type="email" value={form.email} onChange={set('email')} />
        <label htmlFor="admin-users-field-4">Нууц үг *</label><input id="admin-users-field-4" type="password" value={form.password} onChange={set('password')} />
        <label htmlFor="admin-users-field-5">Эрх</label>
        <select id="admin-users-field-5" value={form.role} onChange={set('role')}>
          <option value="STUDENT">Оюутан</option><option value="ADMIN">Админ</option>
        </select>
        <label htmlFor="admin-users-field-6">Мэргэжил</label>
        <select id="admin-users-field-6" value={form.academicProgramId} onChange={set('academicProgramId')}>
          <option value="">— Сонгохгүй —</option>
          {academicPrograms.map((p) => (
            <option key={p.id} value={p.id}>{p.university && p.university !== 'МУИС' ? `${p.university} · ` : ''}{p.school ? `${p.school} · ` : ''}{p.name}</option>
          ))}
        </select>
        <div className="btn-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.name || !form.email || !form.password} onClick={save}>
            {busy ? '…' : 'Нэмэх'}
          </button>
        </div>
    </AdminDialog>
  );
}
