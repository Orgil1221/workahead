import { useEffect, useRef } from 'react';

const paths = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  catalog: 'M3 9 12 4l9 5M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18',
  book: 'M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15',
  graduation: 'm2 9 10-5 10 5-10 5L2 9Zm4 2v6c4 3 8 3 12 0v-6m4-2v8',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  flag: 'M5 21V3m0 1h14l-3 4 3 4H5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  logout: 'M9 4H4v16h5m5-4 4-4-4-4M8 12h12',
  external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  refresh: 'M20 7v5h-5M4 17v-5h5m-4-4a8 8 0 0 1 13-4l2 3M4 17l2 3a8 8 0 0 0 13-4',
  card: 'M3 4h18v16H3V4Zm0 5h18M7 15h4',
  search: 'M21 21l-5-5M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0',
};
export function AdminIcon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.overview} /></svg>;
}
export function AdminHeading({ eyebrow, title, description, children }) {
  return <div className="ad-page-heading"><div>{eyebrow && <p className="ad-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="ad-page-description">{description}</p>}</div>{children && <div className="ad-heading-actions">{children}</div>}</div>;
}
export function AdminEmpty({ title, children, icon = 'book' }) {
  return <div className="ad-empty"><span><AdminIcon name={icon} size={24} /></span><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}
export function AdminError({ error, retry }) {
  return <div className="ad-error" role="alert"><AdminIcon name="flag" /><div><strong>Мэдээллийг ачаалж чадсангүй.</strong><p>{error?.message || 'Дахин оролдоно уу.'}</p></div>{retry && <button className="btn secondary small" onClick={retry}>Дахин оролдох</button>}</div>;
}
export function AdminSkeleton() {
  return <div className="ad-loading" role="status" aria-label="Мэдээлэл ачаалж байна"><div className="ad-kpi-grid">{[0, 1, 2, 3].map((item) => <div key={item} />)}</div><div className="ad-loading-panel" /></div>;
}
export function AdminDialog({ title, onClose, children, busy = false }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(document.activeElement);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      queueMicrotask(() => {
        if (!dialog.open && returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true });
      });
    };
  }, []);
  return <dialog ref={dialogRef} className="ad-dialog" aria-labelledby="ad-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (!busy && event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}><header><h2 id="ad-dialog-title">{title}</h2><button type="button" className="ad-icon-button" disabled={busy} onClick={onClose} aria-label="Хаах"><AdminIcon name="close" /></button></header><fieldset className="ad-dialog-fields" disabled={busy}>{children}</fieldset></dialog>;
}
