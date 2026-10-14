import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Profile.css';

const PHONE = '+976 66336691';
const PHONE_LINK = 'tel:+97666336691';
const FACEBOOK_LINK = 'https://www.facebook.com/profile.php?id=100068091317280';

const iconPaths = {
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  edit: 'm16 3 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z',
  mail: 'M3 5h18v14H3zM3 5l9 7 9-7',
  phone: 'M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z',
  school: 'm2 9 10-5 10 5-10 5L2 9Zm4 2v6l6 3 6-3v-6M22 9v7',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  chevron: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
  sparkle: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  card: 'M3 5h18v14H3zM3 10h18M7 15h3',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-12a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01',
  logout: 'M9 3H4v18h5M10 12h11m-4-4 4 4-4 4',
};

function Icon({ name, size = 20, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

function Detail({ icon, label, children }) {
  return <div className="pf-detail"><span className="pf-detail-icon"><Icon name={icon} size={18} /></span><div><dt>{label}</dt><dd>{children || <span className="pf-unset">Бүртгэгдээгүй</span>}</dd></div></div>;
}

function Membership({ plans, error, onRetry, paymentPath }) {
  const plan = plans?.find((item) => item.owned) || plans?.[0];
  const expiry = plan?.expiresAt ? new Date(plan.expiresAt) : null;
  const validExpiry = expiry && Number.isFinite(expiry.getTime());
  const daysLeft = validExpiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null;
  const price = plan ? new Intl.NumberFormat('mn-MN').format(plan.priceMnt) : '';

  return (
    <section className={`pf-membership pf-panel${plan?.owned ? ' is-active' : ''}`} aria-labelledby="pf-membership-title">
      <div className="pf-membership-top"><span className="pf-icon-tile"><Icon name="card" /></span><span className="pf-eyebrow">ТАНЫ БАГЦ</span>{plan?.owned && <span className="pf-status"><span />Идэвхтэй</span>}</div>
      <h2 id="pf-membership-title">Суралцах эрх</h2>
      {error ? <div className="pf-plan-message" role="alert"><p>Багцын мэдээллийг ачаалж чадсангүй.</p><button type="button" className="pf-text-button" onClick={onRetry}>Дахин ачаалах <Icon name="arrow" size={16} /></button></div>
        : plans === null ? <p className="pf-plan-message" role="status">Багцын мэдээлэл ачаалж байна…</p>
          : !plan ? <div className="pf-plan-message"><p>Шалгалтын бэлтгэлээ нэг дороос.</p><p>Суралцах багцууд удахгүй нэмэгдэнэ.</p><Link className="pf-primary" to="/student">Шалгалтууд үзэх <Icon name="arrow" size={17} /></Link></div>
            : <>
              <p className="pf-plan-name">{plan.title}</p>
              <div className="pf-plan-value">{plan.owned ? <><strong>{daysLeft ?? 'Идэвхтэй'}</strong>{daysLeft !== null && <span>хоног үлдсэн</span>}</> : <><strong>{price}<small>₮</small></strong><span>/ {plan.durationDays || 30} хоног</span></>}</div>
              {plan.owned && validExpiry && <p className="pf-expiry">{new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(expiry)} хүртэл хүчинтэй</p>}
              <ul className="pf-benefits"><li><Icon name="check" size={16} />{plan.examCount ? `${plan.examCount} шалгалт` : 'Бүх шалгалт'}</li><li><Icon name="check" size={16} />AI үнэлгээ, дэлгэрэнгүй бодолт</li><li><Icon name="check" size={16} />Өөрийн хурдаар давтах боломж</li></ul>
              <Link className="pf-primary" to={paymentPath}>{plan.owned ? 'Багцаа удирдах' : 'Багцын дэлгэрэнгүй'}<Icon name="arrow" size={17} /></Link>
              <p className="pf-payment-note">QPay болон картаар төлөх боломжтой</p>
            </>}
    </section>
  );
}

function ProfileEditor({ user, loadPrograms, onSave, onCancel }) {
  const program = user.academicProgram || user.program;
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', programId: program?.id || '', school: program?.school || '', customProgram: '' });
  const [programs, setPrograms] = useState(program ? [program] : []);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setProgramsLoading(true);
    setProgramsError(false);
    loadPrograms().then((items) => {
      if (!alive) return;
      setPrograms((current) => [...items, ...current.filter((item) => !items.some((entry) => entry.id === item.id))]);
      setForm((current) => ({ ...current, school: current.school || items.find((item) => item.id === current.programId)?.school || '' }));
    }).catch(() => {
      if (alive) setProgramsError(true);
    }).finally(() => {
      if (alive) setProgramsLoading(false);
    });
    return () => { alive = false; };
  }, [loadPrograms, retry]);

  const schools = [...new Set(programs.map((item) => item.school).filter(Boolean))].sort();
  if (form.school && !schools.includes(form.school)) schools.push(form.school);
  const filtered = programs.filter((item) => item.school === form.school);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = form.programId === '__custom__'
        ? { name: form.name.trim(), phone: form.phone.trim(), school: form.school, customProgram: form.customProgram.trim() }
        : { name: form.name.trim(), phone: form.phone.trim(), programId: form.programId };
      await onSave(body);
      onCancel();
    } catch (failure) {
      setError(failure.message || 'Хадгалж чадсангүй. Дахин оролдоно уу.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pf-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}>
        <div className="pf-form-grid">
          <div className="pf-field"><label htmlFor="pf-name">Таны нэр</label><input id="pf-name" name="name" autoComplete="name" autoFocus required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div className="pf-field"><label htmlFor="pf-phone">Утасны дугаар</label><input id="pf-phone" name="phone" type="tel" autoComplete="tel" placeholder="Утасны дугаараа оруулах" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
          <div className="pf-field pf-field-wide"><label htmlFor="pf-email">Имэйл хаяг</label><input id="pf-email" type="email" value={user.email || ''} readOnly aria-describedby="pf-email-note" /><span id="pf-email-note" className="pf-field-hint">Бүртгэлтэй имэйл хаягийг эндээс өөрчлөх боломжгүй.</span></div>
          <div className="pf-field pf-field-wide"><label htmlFor="pf-school">Салбар сургууль</label><select id="pf-school" value={form.school} disabled={programsLoading || programsError} onChange={(event) => setForm({ ...form, school: event.target.value, programId: '', customProgram: '' })}><option value="">Салбар сургууль сонгох</option>{schools.map((school) => <option key={school} value={school}>{school}</option>)}</select></div>
          <div className="pf-field pf-field-wide"><label htmlFor="pf-program">Мэргэжил / Хөтөлбөр</label><select id="pf-program" value={form.programId} disabled={!form.school || programsLoading || programsError} onChange={(event) => setForm({ ...form, programId: event.target.value, customProgram: '' })}><option value="">{form.school ? 'Мэргэжил сонгох' : 'Эхлээд салбар сургуулиа сонгоно уу'}</option>{filtered.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="__custom__">Өөр мэргэжил — бичиж оруулах</option></select></div>
          {form.programId === '__custom__' && <div className="pf-field pf-field-wide"><label htmlFor="pf-custom-program">Мэргэжлийн нэр</label><input id="pf-custom-program" required minLength={2} maxLength={80} placeholder="Жишээ: Олон улсын харилцаа" value={form.customProgram} onChange={(event) => setForm({ ...form, customProgram: event.target.value })} /></div>}
        </div>
        {programsLoading && <p className="pf-field-hint" role="status">Мэргэжлийн жагсаалт ачаалж байна…</p>}
        {programsError && <p className="pf-inline-error" role="alert">Мэргэжлийн жагсаалтыг ачаалж чадсангүй. <button type="button" className="pf-text-button" onClick={() => setRetry((value) => value + 1)}>Дахин ачаалах</button></p>}
        {error && <p className="pf-inline-error" role="alert">{error}</p>}
        <div className="pf-form-actions"><button type="submit" className="pf-primary" disabled={busy}>{busy ? 'Хадгалж байна…' : 'Өөрчлөлт хадгалах'}<Icon name="check" size={16} /></button><button type="button" className="pf-secondary" onClick={onCancel}>Цуцлах</button></div>
      </fieldset>
    </form>
  );
}

function PasswordForm({ onChangePassword, onClose }) {
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (password.next !== password.confirm) {
      setError('Шинэ нууц үг давтан оруулсан нууц үгтэй таарахгүй байна.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onChangePassword({ current: password.current, next: password.next });
      onClose();
    } catch (failure) {
      setError(failure.message || 'Нууц үг солигдсонгүй. Дахин оролдоно уу.');
    } finally {
      setBusy(false);
    }
  }

  return <form id="pf-password-form" className="pf-form pf-password-form" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}>
    <div className="pf-field"><label htmlFor="pf-current-password">Одоогийн нууц үг</label><input id="pf-current-password" type="password" autoComplete="current-password" autoFocus required value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} /></div>
    <div className="pf-form-grid">
      <div className="pf-field"><label htmlFor="pf-new-password">Шинэ нууц үг</label><input id="pf-new-password" type="password" autoComplete="new-password" required minLength={8} aria-describedby="pf-password-hint" value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} /></div>
      <div className="pf-field"><label htmlFor="pf-confirm-password">Шинэ нууц үг давтах</label><input id="pf-confirm-password" type="password" autoComplete="new-password" required minLength={8} value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} /></div>
    </div>
    <p id="pf-password-hint" className="pf-field-hint">Нууц үг дор хаяж 8 тэмдэгт байна.</p>
    {error && <p className="pf-inline-error" role="alert">{error}</p>}
    <div className="pf-form-actions"><button className="pf-primary" type="submit" disabled={busy}>{busy ? 'Сольж байна…' : 'Нууц үг шинэчлэх'}</button><button className="pf-secondary" type="button" onClick={onClose}>Цуцлах</button></div>
  </fieldset></form>;
}

export default function ProfileView({ user, plans, plansError = false, onRetryPlans, loadPrograms, onSaveProfile, onChangePassword, onLogout, paymentPath = '/student/payment' }) {
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [aurora, setAurora] = useState(() => {
    try {
      const saved = localStorage.getItem('aurora');
      return saved !== null ? saved === 'true' : !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.dataset.aurora = aurora ? 'on' : 'off';
    try { localStorage.setItem('aurora', String(aurora)); } catch {}
  }, [aurora]);

  const program = user.academicProgram || user.program;
  const hasPlan = plans?.some((plan) => plan.owned);
  const initial = user.name?.trim()[0]?.toLocaleUpperCase('mn-MN') || '?';

  return (
    <div className="student-profile">
      <header className="pf-heading"><div><p className="pf-eyebrow"><span />ТАНЫ СУРАЛЦАХ ОРОН ЗАЙ</p><h1>Миний <em>профайл.</em></h1><p className="pf-subtitle">Таны мэдээлэл. Таны сонголт. Таны хэмнэл.</p></div><span className="pf-heading-mark" aria-hidden="true"><Icon name="user" size={27} /></span></header>

      <section className="pf-identity" aria-label="Хэрэглэгчийн бүртгэл">
        <div className="pf-avatar" aria-hidden="true">{initial}<span><Icon name="school" size={15} /></span></div>
        <div className="pf-identity-info">
          <span className="pf-eyebrow">СУРАЛЦАГЧ</span>
          <h2>{user.name || 'Таны нэр'}</h2>
          <div className="pf-identity-study"><Icon name="school" size={17} /><div>{program?.school && <span>{program.school}</span>}<strong>{program?.name || 'Мэргэжил сонгоогүй'}</strong></div></div>
          <p>{user.email}</p>
          <div className="pf-identity-tags"><span className={hasPlan ? 'pf-tag-active' : 'pf-tag-neutral'}><span className="pf-dot" />{hasPlan ? 'Багц идэвхтэй' : 'WorkAhead суралцагч'}</span></div>
        </div>
        <div className="pf-identity-art" aria-hidden="true"><span /><span /><span /><Icon name="sparkle" size={24} /></div>
      </section>

      <div className="pf-layout">
        <div className="pf-main">
          <section className="pf-panel pf-personal" aria-labelledby="pf-personal-title">
            <div className="pf-panel-heading"><div><p className="pf-eyebrow">01 / ТАНЫ МЭДЭЭЛЭЛ</p><h2 id="pf-personal-title">Хувийн мэдээлэл</h2></div>{!editing && <button type="button" className="pf-edit" onClick={() => setEditing(true)}><Icon name="edit" size={15} />Засах</button>}</div>
            {editing ? <ProfileEditor user={user} loadPrograms={loadPrograms} onSave={onSaveProfile} onCancel={() => setEditing(false)} /> : <dl className="pf-details"><Detail icon="user" label="Нэр">{user.name}</Detail><Detail icon="mail" label="Имэйл хаяг">{user.email}</Detail><Detail icon="phone" label="Утасны дугаар">{user.phone}</Detail><Detail icon="school" label="Мэргэжил / Хөтөлбөр">{program?.name}</Detail></dl>}
          </section>

          <section className="pf-panel pf-settings" aria-labelledby="pf-settings-title">
            <div className="pf-panel-heading"><div><p className="pf-eyebrow">02 / ӨӨРТӨӨ ТААРУУЛАХ</p><h2 id="pf-settings-title">Тохиргоо</h2></div></div>
            <button type="button" className="pf-setting-row pf-password-toggle" aria-expanded={passwordOpen} aria-controls="pf-password-panel" onClick={() => setPasswordOpen((value) => !value)}><span className="pf-setting-icon"><Icon name="lock" size={19} /></span><span className="pf-setting-copy"><strong>Нууц үг солих</strong><span>Бүртгэлийнхээ нууц үгийг шинэчлэх</span></span><Icon name="chevron" size={17} className={passwordOpen ? 'pf-chevron is-open' : 'pf-chevron'} /></button>
            <div id="pf-password-panel">{passwordOpen && <PasswordForm onChangePassword={onChangePassword} onClose={() => setPasswordOpen(false)} />}</div>
            <div className="pf-setting-row pf-appearance"><span className="pf-setting-icon"><Icon name="sparkle" size={19} /></span><div className="pf-setting-copy"><strong id="pf-aurora-label">Арын туяа</strong><span id="pf-aurora-description">Зөөлөн хөдөлгөөнтэй дэвсгэр. Унтраавал батарей хэмнэнэ.</span></div><button type="button" className="pf-switch" role="switch" aria-checked={aurora} aria-labelledby="pf-aurora-label" aria-describedby="pf-aurora-description" onClick={() => setAurora((value) => !value)}><span /></button></div>
          </section>
        </div>

        <aside className="pf-aside" aria-label="Багц ба тусламж">
          <Membership plans={plans} error={plansError} onRetry={onRetryPlans} paymentPath={paymentPath} />
          <section className="pf-panel pf-help" aria-labelledby="pf-help-title"><span className="pf-help-icon"><Icon name="help" size={22} /></span><h2 id="pf-help-title">Тусламж хэрэгтэй юу?</h2><p>Асуух зүйл байвал бидэнтэй холбогдоорой.</p><a className="pf-contact" href={PHONE_LINK}><Icon name="phone" size={17} /><span>{PHONE}</span><Icon name="arrow" size={16} /></a><a className="pf-contact" href={FACEBOOK_LINK} target="_blank" rel="noopener noreferrer"><span className="pf-facebook-mark" aria-hidden="true">f</span><span>Facebook-ээр холбогдох</span><Icon name="arrow" size={16} /></a></section>
        </aside>
      </div>

      <footer className="pf-footer"><div><span className="pf-footer-brand">Work<span>·</span>Ahead</span><Link to="/terms">Үйлчилгээний нөхцөл</Link></div><button type="button" className="pf-logout" onClick={onLogout}><Icon name="logout" size={17} />Бүртгэлээс гарах</button></footer>
    </div>
  );
}
