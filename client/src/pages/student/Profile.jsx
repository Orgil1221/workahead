import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const fmt = (n) => new Intl.NumberFormat('mn-MN').format(n) + '₮';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [busy, setBusy] = useState(false);
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
  const [payModalPlan, setPayModalPlan] = useState(null);

  useEffect(() => {
    api('/payments/plans').then((d) => setPlans(d.plans)).catch(() => setPlans([]));
    loadTxns();
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
    const prog = programs.find((p) => p.id === user.program?.id);
    setForm({ name: user.name || '', phone: user.phone || '', programId: user.program?.id || '', school: prog?.school || prog?.universityName || '', customProgram: '' });
    if (programs.length === 0) {
      api('/programs-public').then((d) => setPrograms(d.programs)).catch(() => {});
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

  // Returning from Bonum hosted page → poll until webhook flips status to PAID
  useEffect(() => {
    if (searchParams.get('payment') !== 'return') return;
    const txn = searchParams.get('txn');
    setSearchParams({}, { replace: true });
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      try {
        const d = await api(`/payments/status/${txn}`);
        if (d.transaction.status === 'PAID') {
          clearInterval(t);
          toast(`Төлбөр амжилттай — ${d.transaction.plan?.title || ''}`);
          loadTxns();
          api('/payments/plans').then((r) => setPlans(r.plans)).catch(() => {});
          return;
        }
        if (d.transaction.status === 'FAILED') {
          clearInterval(t);
          toast('Төлбөр амжилтгүй боллоо');
          return;
        }
      } catch {}
      if (tries >= 10) {
        clearInterval(t);
        toast('Төлбөрийн баталгаажуулалт хүлэгдэж байна… түүхээс шалгана уу');
        loadTxns();
      }
    }, 1500);
    return () => clearInterval(t);
  }, [searchParams]);

  function loadTxns() {
    api('/payments/my').then((d) => setTransactions(d.transactions)).catch(() => {});
  }

  async function buy(plan) {
    if (busy) return;
    setBusy(true);
    try {
      const d = await api('/payments/checkout', { method: 'POST', body: { planId: plan.id } });
      window.location.href = d.followUpLink;
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
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
          {user.program
            ? <span className="badge blue">{user.program.school ? `${user.program.school} · ` : ''}{user.program.name}</span>
            : <span className="small muted">Мэргэжил сонгоогүй</span>}
          {plans?.some((p) => p.owned) && (
            <span className="badge plan-active" style={{ marginLeft: 6 }}>✓ Багц идэвхтэй</span>
          )}
        </div>
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
            // Зөвхөн баталгаат мэргэжлүүд (МТЭС/БС/ХЗС/ШУС/ИТС/УТСОУХНУС) — хичээлүүдийг хасна
            const validSchools = ['МТЭС', 'БС', 'ХЗС', 'ШУС', 'ИТС', 'УТСОУХНУС'];
            const majorPrograms = programs.filter((p) => validSchools.includes(p.school));
            const schools = [...new Set(majorPrograms.map((p) => p.school))].sort();
            const filtered = majorPrograms.filter((p) => p.school === form.school);
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
            <button className="btn small" disabled={busy}>Хадгалах</button>
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

      <div className="profile-section-title">Багц, төлбөр</div>
      {plans === null ? (
        <div className="card"><span className="small muted">Ачааллаж байна…</span></div>
      ) : plans.length === 0 ? null : (
        <>
          {(() => {
            const p = plans[0];
            const isOwned = p.owned;
            const daysLeft = p.expiresAt ? Math.max(0, Math.ceil((new Date(p.expiresAt) - new Date()) / 86400000)) : null;
            return (
              <div className={`card plan-card ${isOwned ? 'plan-owned' : ''}`} style={{ padding: 18, border: isOwned ? '1px solid var(--ok)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <span className="mono small muted">{p.code} · {p.durationDays || 30} хоног</span>
                    <h3 style={{ margin: '4px 0 6px' }}>{p.title}</h3>
                    <span className="small muted">{p.examCount} шалгалт · AI үнэлгээ · Бүх шийдэл</span>
                    {p.description && <p className="small muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>{p.description}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <span className="badge blue">30 хоног</span>
                      <span className="badge">QPay</span>
                      <span className="badge">Карт</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: isOwned ? 'var(--ok)' : 'var(--ink)' }}>{fmt(p.priceMnt)}</div>
                    <span className="small faint">/ 30 хоног</span>
                    <div style={{ marginTop: 10 }}>
                      {isOwned ? (
                        <span className="badge ok" style={{ padding: '6px 10px' }}>✓ {daysLeft !== null ? `${daysLeft} хоног үлдсэн` : 'Идэвхтэй'}</span>
                      ) : (
                        <button className="btn small" onClick={() => setPayModalPlan(p)}>Дэлгэрэнгүй →</button>
                      )}
                    </div>
                  </div>
                </div>
                {isOwned && (
                  <p className="small faint" style={{ margin: '10px 0 0' }}>Дуусах: {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('mn-MN') : '—'} — сунгах бол дахин төлөх боломжтой.</p>
                )}
              </div>
            );
          })()}
          {plans.length > 1 && (
            <div className="small faint" style={{ margin: '8px 2px 0' }}>{plans.length - 1} нэмэлт багц бий — админаас асууна уу.</div>
          )}
          <p className="small faint" style={{ margin: '6px 2px 0' }}>Нэг товч → дэлгэрэнгүй → QPay / Карт сонгоод төлнө. Bonum prod эрхгүй үед тест горим ажиллана.</p>
        </>
      )}
      {plans && plans.length === 0 && (
        <div className="card payment-card">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
          <div>
            <strong>Төлбөрийн систем удахгүй</strong>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              Багцууд удахгүй нэмэгдэнэ.
            </p>
          </div>
        </div>
      )}

      {transactions.length > 0 && (
        <>
          <div className="profile-section-title">Төлбөрийн түүх</div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {transactions.map((t) => {
              const isActive = t.status === 'PAID' && (!t.expiresAt || new Date(t.expiresAt) > new Date());
              const daysLeft = t.expiresAt ? Math.max(0, Math.ceil((new Date(t.expiresAt) - new Date()) / 86400000)) : null;
              const isGift = t.provider === 'GIFT' || t.provider === 'ADMIN_GIFT';
              return (
                <div className="txn-row" key={t.id}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontWeight: 500 }}>{t.plan?.title || 'Багц'} {isGift && <span className="badge blue" style={{ marginLeft: 6, verticalAlign: 'middle' }}>Gift</span>}</strong>
                    <span className="small muted mono">
                      {new Date(t.createdAt).toLocaleDateString('mn-MN')} · {isGift ? 'Gift' : fmt(t.amount)}
                      {t.status === 'PAID' && t.expiresAt && ` · Дуусах: ${new Date(t.expiresAt).toLocaleDateString('mn-MN')} ${isActive && daysLeft !== null ? `(${daysLeft} хоног)` : '(дууссан)'}`}
                    </span>
                  </span>
                  <span className={`txn-status mono ${t.status === 'PAID' ? (isGift ? '' : isActive ? 'ok' : 'fail') : t.status === 'PENDING' ? '' : 'fail'}`} style={isGift ? { color: 'var(--blue-ink)' } : undefined}>
                    {t.status === 'PAID' ? (isGift ? (isActive ? 'GIFT • ИДЭВХТЭЙ' : 'GIFT • ДУУССАН') : (isActive ? 'ИДЭВХТЭЙ' : 'ХУГАЦАА ДУУССАН')) : ({ PAID: 'ТӨЛӨГДСӨН', PENDING: 'ХҮЛЭЭГДЭЖ БАЙНА', FAILED: 'АМЖИЛТГҮЙ' }[t.status] || t.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {payModalPlan && (
        <div className="modal-overlay" onClick={() => setPayModalPlan(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>{payModalPlan.title}</h3>
            <span className="mono small muted">{payModalPlan.code} · {payModalPlan.durationDays || 30} хоногийн эрх</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '12px 0 8px' }}>
              <span className="mono" style={{ fontSize: '1.9rem', fontWeight: 800 }}>{fmt(payModalPlan.priceMnt)}</span>
              <span className="small muted">/ 30 хоног</span>
              <span className="badge blue" style={{ marginLeft: 'auto' }}>{payModalPlan.examCount} шалгалт</span>
            </div>
            {payModalPlan.description && <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>{payModalPlan.description}</p>}
            <div className="card" style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255,253,247,.55)' }}>
              <strong className="small" style={{ display: 'block', marginBottom: 6 }}>Багцад багтсан:</strong>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                <li>Бүх шалгалт ({payModalPlan.examCount}) — Задгай + Тест</li>
                <li>Иж бүрэн шийдэл + AI үнэлгээ + тайлбар</li>
                <li>30 хоног хязгааргүй хандалт — хугацаа дуусахад сунгах боломжтой</li>
                <li>QPay, SocialPay, карт — Bonum-аар баталгаат төлбөр</li>
              </ul>
            </div>
            <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setPayModalPlan(null)}>Цуцлах</button>
              <button className="btn" disabled={busy} onClick={() => buy(payModalPlan)}>
                {busy ? 'Уншиж байна…' : `QPay / Картаар төлөх — ${fmt(payModalPlan.priceMnt)}`}
              </button>
            </div>
            <p className="small faint" style={{ marginTop: 10, textAlign: 'center' }}>Төлөх дархад Bonum хуудас нээгдэж QPay QR / карт сонгоно. Prod эрхгүй үед тест төлбөр ажиллана.</p>
          </div>
        </div>
      )}

      <button className="btn danger profile-logout" onClick={logout}>
        Гарах
      </button>
    </>
  );
}
