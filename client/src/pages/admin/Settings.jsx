import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { WeatherIcon } from '../../components/LandingAtmosphere.jsx';
import { useAdminApi, useAdminLoad } from './AdminContext.jsx';
import { AdminDialog, AdminEmpty, AdminError, AdminHeading, AdminIcon } from './AdminUI.jsx';

const themes = [
  { value: 'auto', title: 'Автомат', description: 'УБ цаг агаар, улирлаар' },
  { value: 'clear', title: 'Энгийн', description: 'Нэмэлт эффектгүй' },
  { value: 'rain', title: 'Бороо', description: 'Борооны хөдөлгөөн' },
  { value: 'snow', title: 'Цас', description: 'Одоогийн цасны эффект' },
  { value: 'newyear', title: 'Шинэ жил', description: 'Цас, гэрэл, чимэглэл' },
];

export default function AdminSettings() {
  return <><AdminHeading eyebrow="САЙТЫН УДИРДЛАГА" title="Тохиргоо" description="Landing хуудасны уур амьсгал, суралцах багцуудыг нэг дор удирд." /><LandingThemeEditor /><PlanEditor /></>;
}
function LandingThemeEditor() {
  const api = useAdminApi();
  const { data, loading, error, retry } = useAdminLoad('/admin/settings/landing-theme');
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const toast = useToast();
  useEffect(() => { if (data) { setSelected(data.landingTheme); setSaved(data.landingTheme); } }, [data]);
  async function save() {
    if (busy || selected === saved) return;
    setBusy(true);
    setSaveError(null);
    try {
      const result = await api('/admin/settings/landing-theme', { method: 'PUT', body: { landingTheme: selected } });
      setSaved(result.landingTheme);
      setSelected(result.landingTheme);
      toast('Landing theme хадгалагдлаа');
    } catch (failure) { setSaveError(failure); }
    finally { setBusy(false); }
  }
  return <section className="ad-panel ad-settings-panel"><div className="ad-panel-heading"><div><p className="ad-eyebrow">ХАРАГДАЦ</p><h2>Landing хуудасны theme</h2></div><AdminIcon name="settings" /></div><p className="ad-panel-description">Үндсэн orange-red өнгө хэвээр. Сонгосон theme нь зөвхөн чимэглэл, цаг агаарын эффектийг өөрчилнө.</p>{loading ? <p className="ad-inline-loading" role="status">Тохиргоо ачаалж байна…</p> : error ? <AdminError error={error} retry={retry} /> : <><fieldset className="ad-theme-options" disabled={busy}><legend className="ad-sr-only">Landing theme сонгох</legend>{themes.map((theme) => <label key={theme.value} className={'ad-theme-option' + (selected === theme.value ? ' is-selected' : '')}><input type="radio" name="admin-landing-theme" value={theme.value} checked={selected === theme.value} onChange={() => setSelected(theme.value)} /><span className={'ad-theme-art ad-theme-art--' + theme.value}><WeatherIcon mode={theme.value} size={33} /><span className="ad-theme-check"><AdminIcon name="check" size={13} /></span></span><strong>{theme.title}</strong><small>{theme.description}</small></label>)}</fieldset><div className="ad-settings-save"><p>{selected !== saved ? <span className="ad-unsaved">Хадгалаагүй өөрчлөлт</span> : <span>Одоо: <strong>{themes.find((theme) => theme.value === saved)?.title || saved}</strong></span>}<small>Автомат: Улаанбаатарын цаг агаар · шинэ жил 12.15–01.10.</small></p><button className="btn" disabled={busy || selected === saved || !selected} onClick={save}>{busy ? 'Хадгалж байна…' : 'Theme хадгалах'}<AdminIcon name="check" size={17} /></button></div>{saveError && <AdminError error={saveError} />}</>}</section>;
}
function PlanEditor() {
  const { data, loading, error, retry } = useAdminLoad('/admin/plans');
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  useEffect(() => { if (data) setPlans(data.plans); }, [data]);
  return <section className="ad-panel ad-settings-panel"><div className="ad-panel-heading"><div><p className="ad-eyebrow">СУРАЛЦАХ ЭРХ</p><h2>Багцын үнэ, хугацаа</h2></div><AdminIcon name="card" /></div><p className="ad-panel-description">Оюутнуудад харагдах багцын нэр, үнэ болон эрхийн хугацааг тохируулна.</p>{loading ? <p role="status" className="ad-inline-loading">Багцууд ачаалж байна…</p> : error ? <AdminError error={error} retry={retry} /> : plans.length ? <div className="ad-plan-grid">{plans.map((plan) => <article className="ad-plan-card" key={plan.id}><div className="ad-plan-top"><span className="mono">{plan.code}</span><span className={'badge ' + (plan.active === false ? '' : 'ok')}>{plan.active === false ? 'Идэвхгүй' : 'Идэвхтэй'}</span></div><h3>{plan.title}</h3><div className="ad-plan-price">{new Intl.NumberFormat('mn-MN').format(plan.priceMnt)}<span>₮</span></div><p>{plan.durationDays ?? 30} хоногийн эрх · {plan._count?.exams ?? 0} шалгалт</p><button className="btn secondary" onClick={() => setEditing(plan)}>Багц засах<AdminIcon name="arrow" size={16} /></button></article>)}</div> : <AdminEmpty title="Багц хараахан алга" icon="card">Бүртгэлтэй багцуудын тохиргоо энд харагдана.</AdminEmpty>}{editing && <PlanDialog plan={editing} onClose={() => setEditing(null)} onSaved={(updated) => { setPlans((current) => current.map((plan) => plan.id === updated.id ? { ...plan, ...updated } : plan)); setEditing(null); }} />}</section>;
}
function PlanDialog({ plan, onClose, onSaved }) {
  const api = useAdminApi();
  const toast = useToast();
  const [form, setForm] = useState({ title: plan.title, priceMnt: plan.priceMnt, durationDays: plan.durationDays ?? 30 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!form.title.trim()) { setError(new Error('Багцын нэрийг оруулна уу.')); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await api('/admin/plans/' + plan.id, { method: 'PUT', body: { title: form.title.trim(), priceMnt: Number(form.priceMnt), durationDays: Number(form.durationDays) } });
      onSaved(result.plan);
      toast('Багц шинэчлэгдлээ');
    } catch (failure) { setError(failure); }
    finally { setBusy(false); }
  }
  return <AdminDialog title="Багц засах" onClose={onClose} busy={busy}><form onSubmit={save}><p className="ad-dialog-description">{plan.code} · Багцын одоогийн тохиргоо</p><fieldset className="ad-form-fields" disabled={busy}><label htmlFor="plan-title">Багцын нэр</label><input id="plan-title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><div className="field-inline"><div><label htmlFor="plan-price">Үнэ (₮)</label><input id="plan-price" required type="number" min="0" step="1" value={form.priceMnt} onChange={(event) => setForm({ ...form, priceMnt: event.target.value })} /></div><div><label htmlFor="plan-duration">Хугацаа (хоног)</label><input id="plan-duration" required type="number" min="1" max="365" step="1" value={form.durationDays} onChange={(event) => setForm({ ...form, durationDays: event.target.value })} /></div></div></fieldset>{error && <AdminError error={error} />}<div className="ad-dialog-actions"><button type="button" className="btn secondary" disabled={busy} onClick={onClose}>Цуцлах</button><button className="btn" disabled={busy}>{busy ? 'Хадгалж байна…' : 'Хадгалах'}</button></div></form></AdminDialog>;
}
