import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

const GROUP_ORDER = ['Улирлын шалгалт', 'Явцын шалгалт', 'Бусад'];

function examGroup(ex) {
  const t = `${ex.title} ${ex.source || ''}`.toLowerCase();
  if (t.includes('улирлын')) return 'Улирлын шалгалт';
  if (t.includes('явцын')) return 'Явцын шалгалт';
  return 'Бусад';
}

export default function ProgramPage() {
  const { programId } = useParams();
  const [exams, setExams] = useState(null);
  const [program, setProgram] = useState(null);

  useEffect(() => {
    api(`/programs/${programId}/exams`)
      .then((d) => {
        setExams(d.exams);
        api('/catalog').then((cat) => {
          for (const u of cat.universities) {
            const p = u.programs.find((x) => x.id === programId);
            if (p) { setProgram({ ...p, university: u }); return; }
          }
        }).catch(() => {});
      })
      .catch(() => {});
  }, [programId]);

  if (!exams) return <Spinner />;

  const groups = GROUP_ORDER.map((g) => ({
    label: g,
    items: exams
      .filter((ex) => examGroup(ex) === g)
      .sort((a, b) => b.year - a.year),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            {program?.university && `${program.university.shortName || program.university.name}`}
          </p>
          <h1 style={{ marginBottom: 0 }}>
            {' '}{program?.name || 'Хичээл'}
          </h1>
        </div>
        <Link to="/student" className="btn secondary small">←</Link>
      </div>

      {groups.map((g) => (
        <section key={g.label} style={{ marginBottom: 18 }}>
          <div className="profile-section-title">{g.label}</div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {g.items.map((ex) => (
              <Link key={ex.id} to={`/student/exam/${ex.id}`} className="row-link">
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontWeight: 500 }}>
                    {ex.title}
                    {ex.isFree
                      ? <span className="badge" style={{ marginLeft: 8, color: 'var(--ok)' }}>Үнэгүй</span>
                      : <span className="badge" style={{ marginLeft: 8, color: 'var(--accent)' }}>Багцаар</span>}
                  </strong>
                  <span className="small muted mono">
                    {ex.year}{ex.variant ? ` · ${ex.variant}` : ''} · {ex._count.questions} асуулт
                  </span>
                </span>
                <span aria-hidden style={{ display: 'inline-flex', color: ex.isFree ? 'var(--ok)' : 'var(--ink-faint)' }}>
                  {ex.isFree ? '' : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
                    </svg>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {exams.length === 0 && (
        <div className="card"><div className="empty-state">Шалгалт байхгүй.</div></div>
      )}
    </>
  );
}
