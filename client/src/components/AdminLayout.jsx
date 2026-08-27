import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/admin', label: 'Статистик', end: true },
  { to: '/admin/catalog', label: 'Бүтэц (Сургууль/Шалгалт)' },
  { to: '/admin/questions', label: 'Асуултын сан' },
  { to: '/admin/import', label: 'Контент импорт' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/users', label: 'Хэрэглэгчид' },
  { to: '/admin/notify', label: 'Мэдэгдэл илгээх' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Work<span>·</span>Ahead</div>
        <div className="nav-section">Админ</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            {l.label}
          </NavLink>
        ))}
        <div style={{ marginTop: 'auto' }}>
          <div className="small muted" style={{ padding: '0 12px 8px' }}>{user?.name}</div>
          <button className="nav-item" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}
            onClick={() => { logout(); navigate('/login'); }}>
            Гарах
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="brand">Work<span>·</span>Ahead</div>
          <button className="btn secondary small" onClick={() => { logout(); navigate('/login'); }}>Гарах</button>
        </header>
        {/* Mobile quick nav */}
        <nav className="filter-bar" style={{ display: 'none' }} aria-hidden />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
