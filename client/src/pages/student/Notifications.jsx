import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { SEEN_KEY } from '../../components/StudentLayout.jsx';

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
