import { useEffect, useRef } from 'react';
import './Chat.css';

export function ChatIcon({ name, size = 20 }) {
  const paths = {
    chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0ZM7 10h10M7 14h6',
    send: 'm21 3-7 18-4-7-7-4 18-7Zm0 0L10 14',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7a4 4 0 0 1 0 8m5 9v-2a4 4 0 0 0-3-3.87',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3',
    mail: 'M3 5h18v14H3zM3 5l9 7 9-7',
    close: 'm6 6 12 12M6 18 18 6',
    flag: 'M5 21V3m0 1h14l-3 5 3 5H5',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    arrow: 'M19 12H5m6-6-6 6 6 6',
    check: 'm5 12 4 4L19 6',
    smile: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M8 9h.01M16 9h.01M7 14s2 3 5 3 5-3 5-3',
    plus: 'M12 5v14M5 12h14',
    pin: 'm16 3 5 5-4 1-4 4 1 4-2 2-7-7 2-2 4 1 4-4 1-4ZM9 15l-6 6',
    reply: 'M9 10H5m4-5-5 5 5 5m-4-5h9a6 6 0 0 1 6 6v3',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    down: 'm6 9 6 6 6-6',
    up: 'm6 15 6-6 6 6',
    gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H7a3 3 0 1 1 3-3l2 3Zm0 0h5a3 3 0 1 0-3-3l-2 3Z',
    book: 'M12 6v15M3 3h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v15h-5a4 4 0 0 0-4 3 4 4 0 0 0-4-3H3V3Z',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z',
    badge: 'm12 2 3 3 4 1 1 4 2 2-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-2 1-4 4-1 3-3Zm-4 10 3 3 5-6',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.chat} /></svg>;
}

export function Avatar({ person, small = false }) {
  return <span className={'ch-avatar' + (small ? ' ch-avatar--small' : '') + (person?.role === 'ADMIN' ? ' ch-avatar--admin' : '')} aria-hidden="true">{person?.name?.trim().slice(0, 1) || '?'}</span>;
}

export function PersonName({ person, fallback = 'Chat' }) {
  return <span className={person?.premium ? 'ch-person-name ch-person-name--premium' : 'ch-person-name'}>{person?.name || fallback}</span>;
}

export function Badges({ badges = [] }) {
  const orderedBadges = [...badges.filter((badge) => badge.id !== 'plan'), ...badges.filter((badge) => badge.id === 'plan')];
  return <span className="ch-badges">{orderedBadges.map((badge) => badge.id === 'plan'
    ? <span key={badge.id} className="ch-badge ch-badge--plan" role="img" aria-label="Идэвхтэй багцтай" title="Идэвхтэй багцтай"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2 2.7 2 3.3-.1.9 3.2L21.5 9l-1.1 3 1.1 3-2.6 1.9-.9 3.2-3.3-.1L12 22l-2.7-2-3.3.1-.9-3.2L2.5 15l1.1-3-1.1-3 2.6-1.9.9-3.2 3.3.1Z" /><path d="m7.5 12 3 3 6-6" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
    : <span key={badge.id} className={'ch-badge ch-badge--' + badge.color} title={badge.description || badge.label}><span aria-hidden="true">{badge.symbol}</span>{badge.label}</span>)}</span>;
}

export function ChatDialog({ title, children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    const frame = requestAnimationFrame(() => { if (element?.isConnected && !element.open) element.showModal(); });
    return () => { cancelAnimationFrame(frame); if (element?.open) element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="ch-dialog" aria-label={title} onClose={onClose} onClick={(event) => { if (event.target !== event.currentTarget) return; const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.current.close(); }}><div className="ch-dialog-heading"><h2>{title}</h2><button type="button" className="ch-icon-button" aria-label="Хаах" onClick={() => dialog.current.close()}><ChatIcon name="close" /></button></div>{children}</dialog>;
}
