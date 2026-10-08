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
      <div className="page-title-row"><h1>Мэдэгдэл</h1></div>
      <PushTestCard />
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
