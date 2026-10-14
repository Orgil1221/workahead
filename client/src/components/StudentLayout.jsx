import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import TabBar from './TabBar.jsx';
import MobileHeader from './MobileHeader.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const tabs = [
  { to: '/student', label: 'Нүүр', icon: 'home', end: true },
  { to: '/student/dashboard', label: 'Ахиц', icon: 'chart' },
  { to: '/student/profile', label: 'Профайл', icon: 'users' },
  { to: '/student/history', label: 'Түүх', icon: 'clock' },
  { to: '/student/payment', label: 'Төлбөр', icon: 'card' },
];

const SEEN_KEY = 'wa_notif_seen';

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const checkUnread = () => {
      api('/notifications')
        .then((d) => {
          if (!alive) return;
          const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
          setUnread(d.notifications.filter((n) => new Date(n.createdAt).getTime() > seen).length);
        })
        .catch(() => {});
    };
    checkUnread();
    const t = setInterval(checkUnread, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Work<span>·</span>Ahead</div>
        <div className="nav-section">Оюутан</div>
        <NavLink to="/student" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Нүүр</NavLink>
        <NavLink to="/student/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Миний ахиц</NavLink>
        <NavLink to="/student/bookmarks" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Хадгалсан асуулт</NavLink>
        <NavLink to="/student/history" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Дүнгийн түүх</NavLink>
        <NavLink to="/student/notifications" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          Мэдэгдэл{unread > 0 && <span className="nav-dot" title="Шинэ мэдэгдэл байна" />}
        </NavLink>
        <NavLink to="/student/profile" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Профайл</NavLink>
        <div style={{ marginTop: 'auto' }}>
          <div className="small muted" style={{ padding: '0 12px 8px' }}>
            {user?.name}
            {user?.program && <> · {user.program.name}</>}
          </div>
          <div style={{ padding: '0 12px 6px' }}>
            <ThemeToggle />
          </div>
          <button className="nav-item" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}
            onClick={() => { logout(); navigate('/login'); }}>
            Гарах
          </button>
        </div>
      </aside>

      <div className="main-col">
        <MobileHeader
          hasUnreadNotifications={unread > 0}
          onBellClick={() => navigate('/student/notifications')}
        />
        <main className={`content${pathname === '/student/dashboard' ? ' dashboard-content' : pathname === '/student/profile' ? ' profile-content' : pathname === '/student/payment' ? ' payment-content' : /^\/student\/(?:(?:u|p|exam|attempt)\/|(?:review|history)$)/.test(pathname) ? ' study-content' : ''}`}>
          <div className="page-enter" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <TabBar items={tabs} />
    </div>
  );
}

export { SEEN_KEY };
