import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { useAdmin, useAdminUser } from '../pages/admin/AdminContext.jsx';
import { AdminIcon } from '../pages/admin/AdminUI.jsx';
import '../pages/admin/Admin.css';
import ChatInviteToast from '../chat/ChatInviteToast.jsx';

const groups = [
  { label: 'ХЯНАЛТ', items: [{ path: '', label: 'Хяналтын самбар', icon: 'overview' }] },
  { label: 'СУРГАЛТЫН КОНТЕНТ', items: [
    { path: '/catalog', label: 'Хичээл, шалгалт', icon: 'catalog' },
    { path: '/questions', label: 'Асуултын сан', icon: 'book' },
    { path: '/import', label: 'Контент импорт', icon: 'upload' },
    { path: '/reports', label: 'Алдааны мэдээлэл', icon: 'flag' },
  ] },
  { label: 'УДИРДЛАГА', items: [
    { path: '/users', label: 'Хэрэглэгчид', icon: 'users' },
    { path: '/chat', label: 'Chat', icon: 'users' },
    { path: '/academic-programs', label: 'Салбар, мэргэжил', icon: 'graduation' },
    { path: '/notify', label: 'Мэдэгдэл', icon: 'bell' },
    { path: '/settings', label: 'Тохиргоо', icon: 'settings' },
  ] },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const user = useAdminUser();
  const { base, preview } = useAdmin();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const drawerRef = useRef(null);
  const menuRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!drawerOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [drawerOpen]);
  const current = groups.flatMap((group) => group.items).find((item) => pathname === base + item.path) || groups[0].items[0];
  useEffect(() => { drawerRef.current?.close(); }, [pathname]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (query.matches) drawerRef.current?.close(); };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, []);
  function closeDrawer() { drawerRef.current.close(); }
  function openDrawer() { drawerRef.current.showModal(); setDrawerOpen(true); }
  function onDrawerClosed() { setDrawerOpen(false); menuRef.current?.focus(); }
  function navigation() {
    return <nav aria-label="Админы үндсэн цэс">{groups.map((group) => <div className="ad-nav-group" key={group.label}><p>{group.label}</p>{group.items.filter((item) => !preview || item.path !== '/chat').map((item) => <NavLink key={item.path} to={base + item.path} end={!item.path} onClick={closeDrawer} className={({ isActive }) => 'ad-nav-link' + (isActive ? ' is-active' : '')}><AdminIcon name={item.icon} /><span>{item.label}</span><AdminIcon name="chevron" size={13} /></NavLink>)}</div>)}</nav>;
  }
  function brand() {
    return <Link className="ad-brand" to={base}>Work<span>·</span>Ahead<small>УДИРДЛАГЫН СИСТЕМ</small></Link>;
  }
  function identity() {
    return <div className="ad-identity"><span className="ad-avatar">{(user?.name || 'Админ').slice(0, 1)}</span><div><strong>{user?.name || 'Админ'}</strong><span>{preview ? 'Туршилтын бүртгэл' : 'Администратор'}</span></div>{preview ? <Link to="/" className="ad-icon-button" aria-label="Preview-ээс гарах"><AdminIcon name="logout" size={18} /></Link> : <button type="button" className="ad-icon-button" aria-label="Бүртгэлээс гарах" onClick={() => { logout(); navigate('/login'); }}><AdminIcon name="logout" size={18} /></button>}</div>;
  }
  const section = current.path.slice(1) || 'dashboard';
  return <div className="admin-shell">
    <ChatInviteToast />
    <a href="#admin-content" className="ad-skip-link">Үндсэн агуулга руу</a>
    <aside className="ad-sidebar">{brand()}{navigation()}<div className="ad-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer" className="ad-site-link"><AdminIcon name="external" size={17} />Сайт нээх</a>{identity()}</div></aside>
    <div className="ad-main">
      <header className="ad-topbar"><div className="ad-topbar-location"><button ref={menuRef} type="button" className="ad-icon-button ad-menu-button" aria-label="Админ цэс нээх" aria-haspopup="dialog" onClick={openDrawer}><AdminIcon name="menu" /></button><span>Удирдлага</span><AdminIcon name="chevron" size={13} /><strong>{current.label}</strong></div><div className="ad-topbar-actions"><span className="ad-role-label">{preview ? 'LOCAL PREVIEW' : 'АДМИН'}</span><ThemeToggle compact /><span className="ad-avatar ad-avatar--small" aria-label={user?.name || 'Админ'}>{(user?.name || 'А').slice(0, 1)}</span></div></header>
      <main id="admin-content" tabIndex="-1" className={'ad-content ad-page--' + section}><Outlet /></main>
      <footer className="ad-footer"><span>WorkAhead · Удирдлагын орон зай</span><span>Контент. Суралцахуй. Ахиц.</span></footer>
    </div>
    <dialog ref={drawerRef} className="ad-drawer" aria-label="Админ цэс" onClose={onDrawerClosed} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX > bounds.right || event.clientY > bounds.bottom) closeDrawer(); } }}><div className="ad-drawer-heading">{brand()}<button type="button" className="ad-icon-button" onClick={closeDrawer} aria-label="Цэс хаах"><AdminIcon name="close" /></button></div>{navigation()}<div className="ad-sidebar-bottom">{identity()}</div></dialog>
  </div>;
}
