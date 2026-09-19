import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const fmt = (n) => new Intl.NumberFormat('mn-MN').format(n) + '₮';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', programId: '', school: '', customProgram: '' });
  const [programs, setPrograms] = useState([]);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [auroraEnabled, setAuroraEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('aurora');
      if (saved !== null) return saved === 'true';
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return true;
    } catch { return true; }
  });
  useEffect(() => {
    api('/payments/plans').then((d) => setPlans(d.plans)).catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('aurora', String(auroraEnabled));
      document.documentElement.dataset.aurora = auroraEnabled ? 'on' : 'off';
    } catch {}
  }, [auroraEnabled]);

  // Анх ачаалахдаа aurora-г шууд хэрэгжүүлэх
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aurora');
      const enabled = saved !== null ? saved === 'true' : !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.documentElement.dataset.aurora = enabled ? 'on' : 'off';
    } catch { document.documentElement.dataset.aurora = 'on'; }
  }, []);

  function startEdit() {
    const prog = programs.find((p) => p.id === (user.academicProgram?.id || user.program?.id));
    setForm({ name: user.name || '', phone: user.phone || '', programId: (user.academicProgram?.id || user.program?.id || ''), school: prog?.school || '', customProgram: '' });
    if (programs.length === 0) {
      api('/academic-programs').then((d) => setPrograms(d.programs)).catch(() => {});
    }
    setEditing(true);
  }

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const isCustom = form.programId === '__custom__';
      const body = isCustom
        ? { name: form.name, phone: form.phone, school: form.school, customProgram: form.customProgram }
        : { name: form.name, phone: form.phone, programId: form.programId };
      const d = await api('/auth/profile', { method: 'PUT', body });
      updateUser(d.user);
      setEditing(false);
      toast('Профайл хадгалагдлаа');
    } catch (err) { toast(err.message); }
  }

  async function changePw(e) {
    e.preventDefault();
    setPwBusy(true);
    try {
      await api('/auth/password', { method: 'POST', body: pw });
      setPw({ current: '', next: '' });
      toast('Нууц үг солигдлоо');
    } catch (err) { toast(err.message); } finally { setPwBusy(false); }
  }

  if (!user) return null;

  return (
    <>
      <div className="page-title-row">
        <h1>Профайл</h1>
      </div>

      <div className="card profile-card">
        <div className="profile-avatar" aria-hidden="true">
          {user.name?.trim()?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{user.name}</h2>
          {(user.academicProgram || user.program)
            ? <span className="badge blue">{(user.academicProgram?.school || user.program?.school) ? `${user.academicProgram?.school || user.program?.school} · ` : ''}{user.academicProgram?.name || user.program?.name}</span>
            : <span className="small muted">Мэргэжил сонгоогүй</span>}
          {plans?.some((p) => p.owned) && (
            <span className="badge plan-active" style={{ marginLeft: 6 }}>✓ Багц идэвхтэй</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, justifyContent: 'flex-start' }}>
        <a href="tel:+97666336691" aria-label="Call +976 66336691" className="icon-btn" style={{ background: 'var(--paper)', border: '1px solid var(--rule)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
        </a>
        <a href="https://www.facebook.com/profile.php?id=100068091317280" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="icon-btn" style={{ background: '#1877F2', color: 'white', border: 'none', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
        </a>
        <span className="small muted" style={{ marginLeft: 4 }}>WorkAhead • <a href="tel:+97666336691" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>+976 66336691</a></span>
      </div>

      <div className="profile-section-title">Холбоо барих мэдээлэл</div>
      {!editing ? (
        <>
          <div className="info-grid">
            <div className="card info-card">
              <span className="info-label">Нэр</span>
              <span className="info-value">{user.name}</span>
            </div>
            <div className="card info-card">
              <span className="info-label">Имэйл</span>
              <span className="info-value">{user.email}</span>
            </div>
            <div className="card info-card">
              <span className="info-label">Утасны дугаар</span>
              <span className="info-value">{user.phone || <span className="faint">Бүртгэгдээгүй</span>}</span>
            </div>
          </div>
          <button className="btn secondary small" style={{ marginTop: 10 }} onClick={startEdit}>
            Мэдээлэл засах
          </button>
        </>
      ) : (
        <form className="card profile-form" onSubmit={saveProfile}>
          <label>Нэр</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label>Утасны дугаар</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {(() => {
            const schools = [...new Set(programs.map((p) => p.school))].sort();
            const filtered = programs.filter((p) => p.school === form.school);
            return (
              <>
                <label>Салбар сургууль</label>
                <select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value, programId: '' })}>
                  <option value="">— Салбар сургууль сонгох —</option>
                  {schools.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <label>Мэргэжил / Хөтөлбөр</label>
                <select value={form.programId} onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value, customProgram: e.target.value === '__custom__' ? f.customProgram : '' }))} disabled={!form.school}>
                  <option value="">{form.school ? '— Мэргэжил сонгох —' : 'Эхлээд салбар сургууль сонгоно уу'}</option>
                  {filtered.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="__custom__">— Өөр мэргэжил (биеэр бичих) —</option>
                </select>
                {form.programId === '__custom__' && (
                  <>
                    <label>Мэргэжлийн нэрээ бичнэ үү *</label>
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      value={form.customProgram}
                      onChange={(e) => setForm({ ...form, customProgram: e.target.value })}
                      placeholder="Жишээ: Олон улсын харилцаа, Ашигт малтмалын инженер…"
                    />
                    <p className="small faint" style={{ margin: '4px 0 0' }}>Бичсэн мэргэжил системд нэмэгдэж, салбар сургууль ({form.school}) дотор бүртгэгдэнэ.</p>
                  </>
                )}
              </>
            );
          })()}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn small">Хадгалах</button>
            <button type="button" className="btn secondary small" onClick={() => setEditing(false)}>Цуцлах</button>
          </div>
        </form>
      )}

      <div className="profile-section-title">Нууц үг солих</div>
      <form className="card profile-form" onSubmit={changePw}>
        <label>Одоогийн нууц үг</label>
        <input type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <label>Шинэ нууц үг (≥6 тэмдэгт)</label>
        <input type="password" required minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <button className="btn small" style={{ marginTop: 12 }} disabled={pwBusy}>Солих</button>
      </form>

      <div className="profile-section-title">Тохиргоо</div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: '.92rem' }}>Aurora эффект</strong>
          <span className="small muted" style={{ display: 'block', marginTop: 2, lineHeight: 1.4 }}>Liquid Glass ард туйлын туяа хөдөлгөөн — унтраавал батарей хэмнэж, бага хурдны утсанд хурдан ажиллана</span>
        </div>
        <label className="switch" aria-label="Aurora on/off">
          <input type="checkbox" checked={auroraEnabled} onChange={(e) => setAuroraEnabled(e.target.checked)} />
          <span className="switch-slider" />
        </label>
      </div>

      <div className="profile-section-title">Төлбөр</div>
      {plans === null ? (
        <div className="card" style={{ padding: 20, textAlign: 'center' }}><span className="small muted">Ачааллаж байна…</span></div>
      ) : plans.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: 'center', borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          <strong>Багцууд удахгүй</strong>
          <span className="small muted">Төлбөрийн багц бэлдэж байна</span>
        </div>
      ) : (
        (() => {
          const p = plans[0];
          const isOwned = p.owned;
          const daysLeft = p.expiresAt ? Math.max(0, Math.ceil((new Date(p.expiresAt) - new Date()) / 86400000)) : null;
          return (
            <Link to="/student/payment" className="card" style={{
              display: 'block',
              padding: 18,
              textDecoration: 'none',
              color: 'inherit',
              background: isOwned ? 'rgba(46,139,87,.06)' : 'rgba(255,253,247,.72)',
              backdropFilter: 'blur(12px)',
              border: isOwned ? '1px solid rgba(46,139,87,.35)' : '1px solid rgba(216,208,189,.55)',
              borderRadius: 16,
              transition: 'transform .15s ease, box-shadow .15s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span className="badge" style={{ background: 'var(--ink)', color: '#fffdf7', borderColor: 'var(--ink)', fontSize: '.68rem' }}>{p.durationDays || 30} хоног</span>
                    <span className="badge blue">QPay</span>
                    <span className="badge">Карт</span>
                    {isOwned && <span className="badge ok">✓ Идэвхтэй</span>}
                  </div>
                  <span className="mono small muted">{p.code}</span>
                  <h3 style={{ margin: '4px 0 6px', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>{p.title}</h3>
                  <span className="small muted">{p.examCount} шалгалт · AI үнэлгээ</span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: isOwned ? 'var(--ok)' : 'var(--ink)' }}>{fmt(p.priceMnt)}</div>
                  <span className="small faint">/ 30 хоног</span>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="small muted" style={{ flex: 1 }}>{isOwned ? (daysLeft !== null ? `${daysLeft} хоног үлдсэн` : 'Идэвхтэй') : 'Дэлгэрэнгүй үзэх →'}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 700, fontSize: '.85rem' }}>{isOwned ? 'Сунгах →' : 'Худалдаж авах →'}</span>
              </div>
            </Link>
          );
        })()
      )}

      <button className="btn danger profile-logout" onClick={logout}>
        Гарах
      </button>

      <footer style={{ textAlign: 'center', padding: '24px 16px 12px', fontSize: '.78rem', color: 'var(--ink-faint)', borderTop: '1px solid var(--rule)', marginTop: 32 }}>
        <div>© 2026 WorkAhead. All rights reserved.</div>
        <div style={{ marginTop: 4 }}>
          <a href="/terms" style={{ color: 'var(--ink-faint)', textDecoration: 'none' }}>Гэрээ</a>
          <span style={{ margin: '0 8px' }}>·</span>
          <a href="/delivery" style={{ color: 'var(--ink-faint)', textDecoration: 'none' }}>Хүргэлт</a>
          <span style={{ margin: '0 8px' }}>·</span>
          <a href="https://www.facebook.com/profile.php?id=100068091317280" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink-faint)', textDecoration: 'none' }}>Facebook</a>
        </div>
      </footer>
    </>
  );
}
