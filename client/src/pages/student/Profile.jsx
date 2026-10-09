import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const fmt = (n) => new Intl.NumberFormat('mn-MN').format(n) + '₮';

const FB_URL = 'https://www.facebook.com/profile.php?id=100068091317280';
const PHONE_HREF = 'tel:+97666336691';
const PHONE_TEXT = '+976 66336691';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', programId: '', school: '', customProgram: '' });
  const [programs, setPrograms] = useState([]);
  const [pwOpen, setPwOpen] = useState(false);
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
      setPwOpen(false);
      toast('Нууц үг солигдлоо');
    } catch (err) { toast(err.message); } finally { setPwBusy(false); }
  }

  if (!user) return null;

  return (
    <>
      <div className="page-title-row">
        <h1>Профайл</h1>
      </div>

      {/* 1 — Хэрэглэгчийн карт */}
      <div className="card profile-card" style={{ overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}>
        <div className="profile-avatar" aria-hidden="true" style={{ flexShrink: 0 }}>
          {user.name?.trim()?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <h2 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</h2>
          {(user.academicProgram || user.program)
            ? (() => {
                const full = `${(user.academicProgram?.school || user.program?.school) ? `${user.academicProgram?.school || user.program?.school} · ` : ''}${user.academicProgram?.name || user.program?.name}`;
                return (
                  <span className="badge blue" title={full} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                    {full}
                  </span>
                );
              })()
            : <span className="small muted">Мэргэжил сонгоогүй</span>}
          {plans?.some((p) => p.owned) && (
            <span className="badge plan-active" style={{ marginLeft: 6, flexShrink: 0 }}>✓ Багц идэвхтэй</span>
          )}
        </div>
      </div>

      {/* 2 — Төлбөр (тохиргоо/нууц үгээс дээгүүр) */}
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
              background: isOwned ? 'rgba(46,139,87,.06)' : 'color-mix(in srgb, var(--paper-raised) 72%, transparent)',
              backdropFilter: 'blur(12px)',
              border: isOwned ? '1px solid rgba(46,139,87,.35)' : '1px solid var(--rule)',
              borderRadius: 16,
              transition: 'transform .15s ease, box-shadow .15s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span className="badge" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)', fontSize: '.68rem' }}>{p.durationDays || 30} хоног</span>
                    <span className="badge blue">QPay</span>
                    <span className="badge">Карт</span>
                    {isOwned && <span className="badge ok">✓ Идэвхтэй</span>}
                  </div>
                  <span className="mono small muted">{p.code}</span>
                  <h3 style={{ margin: '4px 0 6px', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>{p.title}</h3>
                  <span className="small muted">{p.examCount ? `${p.examCount} шалгалт` : 'Бүх шалгалт'} · AI үнэлгээ</span>
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

      {/* 3 — Холбоо барих мэдээлэл (нэг эмх карт) */}
      <div className="profile-section-title">Холбоо барих мэдээлэл</div>
      {!editing ? (
        <>
          <div className="card" style={{ padding: '6px 16px' }}>
            <div className="row-link" style={{ cursor: 'default' }}>
              <span className="info-label">Нэр</span>
              <strong style={{ fontSize: '.92rem', textAlign: 'right' }}>{user.name}</strong>
            </div>
            <div className="row-link" style={{ cursor: 'default' }}>
              <span className="info-label">Имэйл</span>
              <strong style={{ fontSize: '.92rem', textAlign: 'right', wordBreak: 'break-all' }}>{user.email}</strong>
            </div>
            <div className="row-link" style={{ cursor: 'default', borderBottom: 'none' }}>
              <span className="info-label">Утасны дугаар</span>
              <strong style={{ fontSize: '.92rem', textAlign: 'right' }}>{user.phone || <span className="faint">Бүртгэгдээгүй</span>}</strong>
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

      {/* 4 — Нууц үг солих (хумигдсан) */}
      <div className="profile-section-title">Нууц үг солих</div>
      <div className="card" style={{ padding: '6px 16px' }}>
        <button
          type="button"
          onClick={() => setPwOpen((v) => !v)}
          aria-expanded={pwOpen}
          style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 0', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <span style={{ fontSize: '.92rem', fontWeight: 600 }}>Нууц үг солих</span>
          <span aria-hidden="true" style={{ color: 'var(--ink-faint)', transform: pwOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>▾</span>
        </button>
        {pwOpen && (
          <form onSubmit={changePw} style={{ paddingBottom: 14 }}>
            <label style={{ marginTop: 4 }}>Одоогийн нууц үг</label>
            <input type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <label>Шинэ нууц үг (≥8 тэмдэгт)</label>
            <input type="password" required minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <button className="btn small" style={{ marginTop: 12 }} disabled={pwBusy}>Солих</button>
          </form>
        )}
      </div>

      {/* 5 — Тохиргоо */}
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

      <button className="btn danger profile-logout" onClick={logout}>
        Гарах
      </button>

      {/* 6 — Холбоо барих (хамгийн доод хэсэг) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 28 }}>
        <a href={PHONE_HREF} aria-label={`Call ${PHONE_TEXT}`} className="icon-btn" style={{ background: 'var(--paper)', border: '1px solid var(--rule)', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
        </a>
        <a href={FB_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="icon-btn" style={{ background: '#1877F2', color: 'white', border: 'none', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
        </a>
        <a href={PHONE_HREF} className="small muted" style={{ textDecoration: 'none' }}>{PHONE_TEXT}</a>
      </div>

      <footer style={{ textAlign: 'center', padding: '20px 16px 12px', fontSize: '.78rem', color: 'var(--ink-faint)', borderTop: '1px solid var(--rule)', marginTop: 20 }}>
        <div>© 2026 WorkAhead. All rights reserved.</div>
        <div style={{ marginTop: 4 }}>
          <a href="/terms" style={{ color: 'var(--ink-faint)', textDecoration: 'none' }}>Үйлчилгээний нөхцөл</a>
        </div>
      </footer>
    </>
  );
}
