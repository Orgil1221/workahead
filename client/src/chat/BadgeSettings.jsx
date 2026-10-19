import { useEffect, useId, useState } from 'react';
import { api } from '../api/client.js';
import { Avatar, Badges, ChatIcon, PersonName } from './ChatUI.jsx';

const colorNames = { orange: 'Улбар шар', violet: 'Нил ягаан', blue: 'Цэнхэр', green: 'Ногоон' };

export default function BadgeSettings() {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api('/chat/bootstrap').then((result) => { if (active) { setData(result); setSettings(result.me.settings); } }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [revision]);
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try { await api('/chat/profile', { method: 'PUT', body: settings }); setNotice('Chat профайл хадгалагдлаа.'); setRevision((value) => value + 1); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const earned = data?.me.earned || [];
  const rank = earned.find((badge) => badge.id === 'rank');
  const choices = rank ? [rank, ...data.catalog] : (data?.catalog || []);
  const selected = earned.find((badge) => badge.id === settings?.selectedBadge);
  const displayBadges = data ? [...data.me.badges.filter((badge) => ['admin', 'school', 'plan'].includes(badge.id)), ...(selected ? [{ ...selected, color: settings.badgeColor }] : [])] : [];
  return <section className="pf-panel ch-badge-settings" aria-labelledby="ch-badge-title">
    <div className="pf-panel-heading"><div><p className="pf-eyebrow">CHAT / ТАНЫ ОНЦЛОГ</p><h2 id="ch-badge-title">Миний badge</h2></div><button type="button" className="ch-badge-toggle" aria-label={expanded ? 'Миний badge хураах' : 'Миний badge дэлгэх'} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(!expanded)}><ChatIcon name="badge" size={24} /><ChatIcon name={expanded ? 'up' : 'down'} size={18} /></button></div>
    <div id={contentId} hidden={!expanded}>
    <p className="ch-subtle">Амжилтаа цуглуулаад, чатад харагдах нэг badge сонгоорой.</p>
    {error && <p role="alert" className="ch-error">{error}<button type="button" onClick={() => { setError(''); setRevision((value) => value + 1); }}>Дахин ачаалах</button></p>}
    {!data ? !error && <p role="status">Badge ачаалж байна…</p> : <form onSubmit={save}><fieldset disabled={busy}>
      <div className="ch-identity-preview"><Avatar person={data.me} /><div><strong><PersonName person={data.me} /></strong><Badges badges={displayBadges} /></div><span className="ch-subtle">Урьдчилан харах</span></div>
      <div className="ch-badge-grid">
        <button type="button" aria-pressed={!settings.selectedBadge} className={'ch-badge-choice' + (!settings.selectedBadge ? ' is-selected' : '')} onClick={() => setSettings({ ...settings, selectedBadge: null })}><span>◌</span><strong>Энгийн</strong><small>Амжилтын badge нуух</small></button>
        {choices.map((badge) => {
          const unlocked = earned.some((item) => item.id === badge.id);
          return <button key={badge.id} type="button" disabled={!unlocked} aria-pressed={settings.selectedBadge === badge.id} className={'ch-badge-choice' + (settings.selectedBadge === badge.id ? ' is-selected' : '')} onClick={() => setSettings({ ...settings, selectedBadge: badge.id })}><span>{unlocked ? badge.symbol : <ChatIcon name="lock" />}</span><strong>{badge.label}</strong><small>{badge.description}</small></button>;
        })}
      </div>
      <p className="ch-subtle">Top 10 байр автоматаар шинэчлэгдэнэ. Тест/задгай шалгалтыг дуусгаж, хариулт оруулсан байх ёстой. Ижил шалгалтын нэг өдрийн давталтыг нэг удаа тоолно. Тэнцвэл тухайн тоонд түрүүлж хүрсэн нь урд байна.</p>
      <div className="ch-color-options" aria-label="Badge өнгө">{data.colors.map((color) => <button key={color} type="button" className={'ch-color ch-color--' + color} aria-label={colorNames[color]} aria-pressed={settings.badgeColor === color} onClick={() => setSettings({ ...settings, badgeColor: color })}>{settings.badgeColor === color && <ChatIcon name="check" size={16} />}</button>)}<span>Амжилтын badge-ийн өнгө</span></div>
      <label className="ch-setting"><span><strong>Хувийн чатны урилга</strong><small>Бусад хүн танд 1v1 чатны урилга илгээх боломжтой.</small></span><input type="checkbox" checked={settings.allowInvites} onChange={(event) => setSettings({ ...settings, allowInvites: event.target.checked })} /></label>
      <label className="ch-setting"><span><strong>Нийтийн чатны тэмдэглэгээг намсгах</strong><small>Шинэ мессеж ирэхэд чат дотор анхааруулахгүй.</small></span><input type="checkbox" checked={settings.muted} onChange={(event) => setSettings({ ...settings, muted: event.target.checked })} /></label>
      {data.blocked.length > 0 && <div className="ch-blocked"><strong>Блоклосон хүмүүс</strong>{data.blocked.map((person) => <div key={person.id}><span><PersonName person={person} /></span><button type="button" onClick={async () => { try { await api('/chat/blocks/' + person.id, { method: 'PUT', body: { blocked: false } }); setRevision((value) => value + 1); } catch (failure) { setError(failure.message); } }}>Блок гаргах</button></div>)}</div>}
      <div className="ch-setting-footer"><button className="ch-primary" disabled={busy}>{busy ? 'Хадгалж байна…' : 'Хадгалах'}</button>{notice && <span role="status">{notice}</span>}</div>
    </fieldset></form>}
    </div>
  </section>;
}
