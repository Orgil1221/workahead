import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { SEEN_KEY } from '../../components/StudentLayout.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { pushSupport, getSubscriptionState, enablePush, disablePush, sendTestPush } from '../../push.js';

function PushTestCard() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const s = await getSubscriptionState();
      setState({ loading: false, ...s });
    } catch {
      setState({ loading: false, supported: pushSupport.supported, permission: pushSupport.permission(), subscribed: false });
    }
  };

  useEffect(() => { refresh(); }, []);

  const onEnable = async () => {
    setBusy(true);
    try {
      await enablePush();
      toast('Push асаалттай — тест явуулж үзээрэй');
      await refresh();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  const onTest = async () => {
    setBusy(true);
    try {
      const r = await sendTestPush('WorkAhead тест', 'Push ажиллаж байна! Утсаа түгжээд шалгаарай.');
      toast(`Тест илгээлээ (${r.sent}/${r.total} төхөөрөмж)`);
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  const onDisable = async () => {
    setBusy(true);
    try {
      await disablePush();
      toast('Push унтраалттай');
      await refresh();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  if (state.loading) return null;
  if (!state.supported) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>Push notification</h3>
        <p className="small muted" style={{ margin: 0 }}>Энэ browser push дэмжихгүй — Chrome/Safari шинэ хувилбараар ороорой.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3 style={{ margin: '0 0 6px' }}>Push notification турших</h3>
      <p className="small muted" style={{ margin: '0 0 10px' }}>
        Төлөв: {state.permission === 'granted' && state.subscribed ? 'асаалттай' : state.permission === 'denied' ? 'хориглогдсон (browser тохиргооноос зөвшөөрнө үү)' : 'унтраалттай'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!state.subscribed ? (
          <button className="btn" onClick={onEnable} disabled={busy}>
            {busy ? 'Түр хүлээнэ үү…' : 'Push асаах'}
          </button>
        ) : (
          <>
            <button className="btn" onClick={onTest} disabled={busy}>
              {busy ? 'Илгээж байна…' : 'Тест push явуулах'}
            </button>
            <button className="btn ghost-danger small" onClick={onDisable} disabled={busy}>Унтраах</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Notifications() {
  const [notifications, setNotifications] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    api('/notifications')
      .then((d) => {
        setNotifications(d.notifications);
        localStorage.setItem(SEEN_KEY, String(Date.now()));
      })
      .catch(() => {});
  }, []);

  if (!notifications) return <Spinner />;

  return (
    <>
      <div className="page-title-row" style={{ position: 'relative' }}>
        <h1 style={{ margin: 0 }}>Мэдэгдэл</h1>
        <button className="icon-btn" onClick={() => setShowSettings((v) => !v)} title="Push тохиргоо" aria-label="Push тохиргоо">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10l2.1 2.1m0-14.2l-2.1 2.1m-10 10l-2.1 2.1" />
          </svg>
        </button>
        {showSettings && (
          <>
            <div className="popover-scrim" onClick={() => setShowSettings(false)} />
            <div className="gear-popover">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong style={{ fontSize: '.9rem' }}>Push тохиргоо</strong>
                <button className="icon-btn" onClick={() => setShowSettings(false)} aria-label="Хаах">✕</button>
              </div>
              <PushTestCard />
            </div>
          </>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="card"><div className="empty-state">Мэдэгдэл байхгүй.</div></div>
      ) : (
        notifications.map((n) => (
          <div className="card" key={n.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>{n.title}</h3>
              {n.program && <span className="badge blue">{n.program.name}</span>}
            </div>
            <p style={{ margin: '4px 0' }}>{n.body}</p>
            <p className="faint small" style={{ margin: 0 }}>
              {new Date(n.createdAt).toLocaleString('mn-MN')}
            </p>
          </div>
        ))
      )}
    </>
  );
}
