import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [plans, setPlans] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api('/admin/stats').then(setStats).catch((e) => setError(e.message));
    api('/admin/plans').then((d) => setPlans(d.plans)).catch(() => {});
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return <Spinner />;

  const t = stats.totals;

  return (
    <>
      <div className="page-title-row">
        <h1>Статистик самбар</h1>
        <Link className="btn secondary small" to="/admin/reports">
          Шинэ flag: <span className="mono">{t.newFlags}</span>
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-value">{t.users}</div><div className="stat-label">Идэвхтэй хэрэглэгч</div></div>
        <div className="stat-card"><div className="stat-value">{t.attempts}</div><div className="stat-label">Нийт тестийн оролдлого</div></div>
        <div className="stat-card"><div className="stat-value">{t.questions}</div><div className="stat-label">Асуултын сан</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: t.newFlags ? 'var(--accent)' : undefined }}>{t.newFlags}</div><div className="stat-label">Шинэ flag</div></div>
      </div>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--ok)' }}><div className="stat-value" style={{ color: 'var(--ok)' }}>{t.paidUsers ?? 0}</div><div className="stat-label">Төлбөр төлсөн (нийт)</div><span className="small faint">Идэвхтэй: {t.activePaid ?? 0}</span></div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--blue-ink)' }}><div className="stat-value" style={{ color: 'var(--blue-ink)' }}>{t.giftUsers ?? 0}</div><div className="stat-label">Gift эрх (админ)</div><span className="small faint">Идэвхтэй: {t.activeGift ?? 0}</span></div>
        <div className="stat-card"><div className="stat-value">{(t.paidUsers ?? 0) + (t.giftUsers ?? 0)}</div><div className="stat-label">Нийт эрхтэй</div><span className="small faint">Идэвхтэй: {(t.activePaid ?? 0) + (t.activeGift ?? 0)}</span></div>
        <div className="stat-card"><div className="stat-value">{t.users ? Math.round(((t.activePaid ?? 0) / t.users) * 100) : 0}%</div><div className="stat-label">Төлбөрт хөрвөлт (идэвхтэй)</div></div>
      </div>

      {plans && <PlanPriceEditor plans={plans} onSaved={(updated) => setPlans(updated)} toast={toast} />}

      <LandingThemeEditor toast={toast} />

      <h2>Хамгийн их flag-тай асуултууд</h2>
      {stats.mostFlagged.length === 0 ? (
        <p className="muted">Flag ирээгүй байна.</p>
      ) : (
        <div className="card">
          {stats.mostFlagged.map((q) => (
            <Link key={q.id} to={`/admin/questions?q=${q.id}`} className="row-link">
              <span style={{ minWidth: 0 }}>
                <span className="mono small muted">{q.exam?.title}</span>
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.prompt.replace(/\$[^$]*\$/g, '…').slice(0, 90)}
                </span>
              </span>
              <span className="badge accent">{q._count.flags} flag</span>
            </Link>
          ))}
        </div>
      )}

      <h2>Сул сэдвүүд (оюутны дундаж гүйцэтгэл — anonymized)</h2>
      {stats.weakTopics.length === 0 ? (
        <p className="muted">Гүйцэтгэлийн өгөгдөл хураагдаагүй байна.</p>
      ) : (
        <div className="card">
          {stats.weakTopics.map((w) => (
            <div key={w.topic} style={{ marginBottom: 12 }}>
              <div className="row-link" style={{ borderBottom: 'none', padding: '0 0 4px' }}>
                <strong>{w.topic}</strong>
                <span className="mono small" style={{ color: w.percent < 50 ? 'var(--accent)' : 'var(--ink-soft)' }}>{w.percent}%</span>
              </div>
              <div className="progress-track">
                <div className={`progress-fill ${w.percent < 50 ? 'low' : ''}`} style={{ width: `${w.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LandingThemeEditor({ toast }) {
  const [theme, setTheme] = useState('auto');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/settings/landing-theme').then((d) => setTheme(d.landingTheme || 'auto')).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const d = await api('/admin/settings/landing-theme', { method: 'PUT', body: { landingTheme: theme } });
      setTheme(d.landingTheme);
      toast('Landing theme хадгалагдлаа — зочдод шууд үйлчилнэ');
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h2>Landing цаг агаар</h2>
      <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ minWidth: 180 }}>
            <option value="auto">Авто (УБ цаг агаар + шинэ жил улирал)</option>
            <option value="clear">Энгийн</option>
            <option value="rain">Бороо</option>
            <option value="snow">Цас</option>
            <option value="newyear">Шинэ жил</option>
          </select>
          <button className="btn small" disabled={busy} onClick={save}>{busy ? '…' : 'Хадгалах'}</button>
        </div>
        <p className="small faint" style={{ margin: '8px 0 0' }}>Авто үед бороо/цас Улаанбаатарын бодит цаг агаараас, шинэ жил 12.15–01.10 хооронд автоматаар асна.</p>
      </div>
    </>
  );
}

function PlanPriceEditor({ plans, onSaved, toast }) {
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const startEdit = (p) => setEditing({ id: p.id, priceMnt: p.priceMnt, durationDays: p.durationDays || 30, title: p.title });

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api(`/admin/plans/${editing.id}`, { method: 'PUT', body: { priceMnt: Number(editing.priceMnt), durationDays: Number(editing.durationDays), title: editing.title } });
      toast('Багц шинэчлэгдлээ');
      const newPlans = plans.map((p) => p.id === updated.plan.id ? { ...p, ...updated.plan } : p);
      onSaved(newPlans);
      setEditing(null);
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h2>Багцын тохиргоо (1 сарын эрх)</h2>
      <div className="card">
        {plans.map((p) => (
          <div key={p.id} className="row-link" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span>
                <strong>{p.title}</strong> <span className="mono small muted">{p.code}</span>
                <span className="small muted" style={{ display: 'block' }}>{p._count.exams} шалгалт · {p.durationDays || 30} хоног</span>
              </span>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--ink)' }}>{new Intl.NumberFormat('mn-MN').format(p.priceMnt)}₮</span>
            </div>
            <span className="btn-row">
              <button className="btn secondary small" onClick={() => startEdit(p)}>Үнэ засах</button>
            </span>
          </div>
        ))}
      </div>
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Багц засах</h3>
            <label>Нэр</label><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <label>Үнэ (₮)</label><input type="number" min="0" value={editing.priceMnt} onChange={(e) => setEditing({ ...editing, priceMnt: e.target.value })} />
            <label>Хугацаа (хоног)</label><input type="number" min="1" max="365" value={editing.durationDays} onChange={(e) => setEditing({ ...editing, durationDays: e.target.value })} />
            <div className="btn-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setEditing(null)}>Цуцлах</button>
              <button className="btn" disabled={busy} onClick={save}>{busy ? '…' : 'Хадгалах'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
