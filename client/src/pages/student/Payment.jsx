import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const fmt = (n) => new Intl.NumberFormat('mn-MN').format(n) + '₮';

export default function Payment() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [payModalPlan, setPayModalPlan] = useState(null);

  useEffect(() => {
    api('/payments/plans').then((d) => setPlans(d.plans)).catch(() => setPlans([]));
    api('/payments/my').then((d) => setTransactions(d.transactions)).catch(() => {});
  }, []);

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
          api('/payments/my').then((d2) => setTransactions(d2.transactions)).catch(() => {});
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
        api('/payments/my').then((d2) => setTransactions(d2.transactions)).catch(() => {});
      }
    }, 1500);
    return () => clearInterval(t);
  }, [searchParams]);

  async function buy(plan) {
    if (busy) return;
    setBusy(true);
    try {
      const d = await api('/payments/checkout', { method: 'POST', body: { planId: plan.id } });
      if (!d.followUpLink) throw new Error('followUpLink хоосон — Bonum тохиргоо шалгана уу');
      if (d.mock) toast('Тест горим — 3 секундын дараа баталгаажна');
      window.location.href = d.followUpLink;
    } catch (e) {
      const msg = e.message || 'Төлбөр үүсгэхэд алдаа';
      const detail = e.detail || '';
      if (msg.includes('Гарц тохируулаагүй') || msg.includes('GATEWAY_NOT_CONFIGURED')) {
        toast('Төлбөрийн гарц тохируулаагүй — админтай холбогдоно уу');
      } else if (msg.includes('Гарц түр') || msg.includes('GATEWAY_ERROR') || e.code === 'GATEWAY_ERROR') {
        toast(`Bonum алдаа: ${detail ? detail.slice(0,120) : msg}`);
        console.error('Bonum detail:', e);
      } else {
        toast(msg);
      }
      setBusy(false);
    }
  }

  if (!user) return null;

  const activePlan = plans?.find((p) => p.owned) || null;

  return (
    <>
      <div className="page-title-row" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: '1.6rem' }}>Төлбөр</h1>
          <p className="small muted" style={{ margin: '4px 0 0' }}>Багц сонгож, 30 хоногийн эрхээ идэвхжүүлнэ</p>
        </div>
      </div>

      {plans === null ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}><span className="small muted">Ачааллаж байна…</span></div>
      ) : plans.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center', borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          <strong>Багцууд удахгүй</strong>
          <span className="small muted">Одоогоор идэвхтэй багц алга</span>
        </div>
      ) : (
        <>
          {/* Hero plan - AI service style clean */}
          {(() => {
            const p = plans[0];
            const isOwned = p.owned;
            const daysLeft = p.expiresAt ? Math.max(0, Math.ceil((new Date(p.expiresAt) - new Date()) / 86400000)) : null;
            return (
              <div className="card" style={{
                padding: 22,
                background: isOwned ? 'rgba(46,139,87,.06)' : 'rgba(255,253,247,.72)',
                backdropFilter: 'blur(16px) saturate(1.5)',
                border: isOwned ? '1px solid rgba(46,139,87,.35)' : '1px solid rgba(216,208,189,.65)',
                boxShadow: '0 10px 30px rgba(33,29,23,.08), 0 1px 2px rgba(33,29,23,.06)',
                borderRadius: '18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span className="badge" style={{ background: 'var(--ink)', color: '#fffdf7', borderColor: 'var(--ink)' }}>{p.durationDays || 30} хоног</span>
                  <span className="badge blue">QPay</span>
                  <span className="badge">Карт</span>
                  {isOwned && <span className="badge ok" style={{ marginLeft: 'auto' }}>✓ Идэвхтэй</span>}
                </div>
                <span className="mono small muted">{p.code}</span>
                <h2 style={{ margin: '6px 0 8px', fontFamily: 'Fraunces, serif', fontSize: '1.45rem', lineHeight: 1.2 }}>{p.title}</h2>
                {p.description && <p className="small muted" style={{ margin: 0, lineHeight: 1.5, maxWidth: 520 }}>{p.description}</p>}
                <div className="small muted" style={{ marginTop: 8 }}>{p.examCount} шалгалт · AI үнэлгээ · Бүх шийдэл</div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontSize: '1.9rem', fontWeight: 800, color: isOwned ? 'var(--ok)' : 'var(--ink)' }}>{fmt(p.priceMnt)}</span>
                  <span className="small muted">/ 30 хоног</span>
                  <div style={{ marginLeft: 'auto' }}>
                    {isOwned ? (
                      <span className="small muted">Дуусах: {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('mn-MN') : '—'} {daysLeft !== null && `· ${daysLeft} хоног үлдсэн`}</span>
                    ) : (
                      <button className="btn" onClick={() => setPayModalPlan(p)} disabled={busy} style={{ padding: '10px 18px', fontWeight: 700 }}>
                        Худалдаж авах
                      </button>
                    )}
                  </div>
                </div>
                {plans.length > 1 && <div className="small faint" style={{ marginTop: 10 }}>{plans.length - 1} нэмэлт багц бий</div>}
              </div>
            );
          })()}

          {/* Active plan summary if owned different from hero */}
          {activePlan && plans[0]?.id !== activePlan.id && (
            <div className="card" style={{ padding: 16, border: '1px solid var(--ok)', background: 'rgba(46,139,87,.05)' }}>
              <strong>Идэвхтэй багц: {activePlan.title}</strong>
              <span className="small muted" style={{ marginLeft: 8 }}>Дуусах: {activePlan.expiresAt ? new Date(activePlan.expiresAt).toLocaleDateString('mn-MN') : '—'}</span>
            </div>
          )}
        </>
      )}

      {/* Transaction history - minimal */}
      {transactions.length > 0 && (
        <>
          <h3 className="profile-section-title" style={{ marginTop: 22 }}>Гүйлгээний түүх</h3>
          <div className="card" style={{ padding: '6px 16px' }}>
            {transactions.slice(0, 8).map((t) => {
              const isActive = t.status === 'PAID' && (!t.expiresAt || new Date(t.expiresAt) > new Date());
              return (
                <div key={t.id} className="txn-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px dashed var(--rule)', gap: 12 }}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontWeight: 600, fontSize: '.92rem' }}>{t.plan?.title || 'Багц'}</strong>
                    <span className="small muted mono">{new Date(t.createdAt).toLocaleDateString('mn-MN')} · {fmt(t.amount)}</span>
                  </span>
                  <span className={`mono small ${t.status === 'PAID' ? (isActive ? 'ok' : '') : t.status === 'PENDING' ? '' : 'faint'}`} style={{ fontSize: '.78rem', fontWeight: 600, flexShrink: 0 }}>
                    {t.status === 'PAID' ? (isActive ? 'ИДЭВХТЭЙ' : 'ДУУССАН') : ({ PENDING: 'ХҮЛЭЭГДЭЖ БАЙНА', FAILED: 'АМЖИЛТГҮЙ' }[t.status] || t.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Clean modal */}
      {payModalPlan && (
        <div className="modal-overlay" onClick={() => setPayModalPlan(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ margin: '4px 0 6px', fontFamily: 'Fraunces, serif' }}>{payModalPlan.title}</h3>
            <span className="mono small muted">{payModalPlan.code} · {payModalPlan.durationDays || 30} хоног</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 10px' }}>
              <span className="mono" style={{ fontSize: '2rem', fontWeight: 800 }}>{fmt(payModalPlan.priceMnt)}</span>
              <span className="small muted">/ 30 хоног</span>
              <span className="badge blue" style={{ marginLeft: 'auto' }}>{payModalPlan.examCount} шалгалт</span>
            </div>
            <div className="card" style={{ marginTop: 10, padding: '12px 14px', background: 'rgba(255,253,247,.55)', borderRadius: 12 }}>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Бүх шалгалт ({payModalPlan.examCount}) — Тест + Задгай</li>
                <li>Бүх шийдэл + AI үнэлгээ</li>
                <li>30 хоног хязгааргүй хандалт</li>
              </ul>
            </div>
            <div className="btn-row" style={{ marginTop: 18, justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn secondary" onClick={() => setPayModalPlan(null)}>Цуцлах</button>
              <button className="btn" disabled={busy} onClick={() => buy(payModalPlan)} style={{ fontWeight: 700 }}>
                {busy ? 'Уншиж байна…' : `Төлөх — ${fmt(payModalPlan.priceMnt)}`}
              </button>
            </div>
            <p className="small muted" style={{ marginTop: 10, textAlign: 'center', opacity: .7 }}>SSL · Bonum</p>
          </div>
        </div>
      )}
    </>
  );
}
