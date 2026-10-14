import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './Study.css';

const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  book: 'M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2V4Z',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  clock: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  check: 'm5 12 4 4L19 6',
  chart: 'M4 4v16h16M8 16v-4m4 4V8m4 8V5',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
  flag: 'M5 21V3h14l-3 4 3 4H5',
  close: 'm6 6 12 12M6 18 18 6',
};
export function StudyIcon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.book} /></svg>;
}
export function StudyHeading({ eyebrow, title, description, back, children }) {
  return <header className="sl-heading">
    {back && <Link className="sl-back" to={back.to}><StudyIcon name="back" size={16} />{back.label}</Link>}
    <div className="sl-eyebrow">{eyebrow}</div>
    <div className="sl-heading-row"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</div>
  </header>;
}
export function StudyState({ loading, error, title = 'Одоогоор мэдээлэл алга', description, retry, children }) {
  return <div className="sl-state sl-card" role={error ? 'alert' : 'status'}>
    <span className={loading ? 'sl-loader' : 'sl-state-icon'}>{!loading && <StudyIcon name={error ? 'flag' : 'book'} size={26} />}</span>
    <h2>{loading ? 'Ачаалж байна…' : error ? 'Мэдээлэл ачаалж чадсангүй' : title}</h2>
    <p>{error ? 'Холболтоо шалгаад дахин оролдоно уу.' : description}</p>
    {error && retry && <button className="sl-button" onClick={retry}>Дахин оролдох</button>}{children}
  </div>;
}
export function StudyDialog({ title, onClose, busy, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  return createPortal(<dialog ref={dialogRef} className="sl-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="sl-row"><h2 id={titleId}>{title}</h2><button type="button" className="sl-icon-button" aria-label="Хаах" disabled={busy} onClick={onClose}><StudyIcon name="close" /></button></div>
    {children}
  </dialog>, document.body);
}
export function CourseCards({ programs, base }) {
  return <div className="sl-course-grid">{programs.map((program, index) => <Link key={program.id} className="sl-card sl-course" to={base + '/p/' + program.id}>
    <div className="sl-row"><span className={'sl-course-icon sl-tone-' + index % 3}><StudyIcon name="book" size={25} /></span><span className="sl-code">{program.code || 'ХИЧЭЭЛ'}</span></div>
    <div><h3>{program.name}</h3><p>{program.university?.shortName || program.university?.name || 'Хичээлийн шалгалтууд'}</p></div>
    <div className="sl-course-bottom"><span>{program._count?.exams ?? 0} шалгалт</span><span className="sl-circle"><StudyIcon name="arrow" size={18} /></span></div>
  </Link>)}</div>;
}
