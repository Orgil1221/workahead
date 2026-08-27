import { NavLink, useLocation } from 'react-router-dom';

const icons = {
  home: 'M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  book: 'M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 0-2 2V5zm4 2h8m-8 4h8',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  bell: 'M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0',
  flag: 'M5 21V4m0 1h13l-3 4 3 4H5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 3',
  users: 'M16 19a4 4 0 0 0-8 0m4-7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 1 0 7zm9 7a4 4 0 0 0-3-3.87M17 5.13A3.5 3.5 0 0 1 17 12',
};

export default function TabBar({ items }) {
  const { pathname } = useLocation();
  const idx = items.findIndex((it) =>
    it.end ? pathname === it.to : pathname.startsWith(it.to)
  );

  return (
    <nav className="tabbar">
      <span
        className="tab-bubble"
        style={{
          width: `${100 / items.length}%`,
          transform: `translateX(${Math.max(idx, 0) * 100}%)`,
          opacity: idx >= 0 ? 1 : 0,
        }}
        aria-hidden="true"
      />
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end}
          className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={icons[it.icon]} />
          </svg>
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
