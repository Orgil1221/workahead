import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

export default function History() {
  const [attempts, setAttempts] = useState(null);

  useEffect(() => {
    api('/attempts/history/list').then((d) => setAttempts(d.attempts)).catch(() => {});
  }, []);

  if (!attempts) return <Spinner />;

  return (
    <>
      <div className="page-title-row"><h1>Дүнгийн түүх</h1></div>
      <div className="card" style={{ padding: '4px 16px' }}>
        {attempts.length === 0 ? (
          <div className="empty-state">Дуусгасан тест байхгүй.</div>
        ) : attempts.map((a) => {
          const pct = a.totalPoints ? Math.round((a.score / a.totalPoints) * 100) : 0;
          return (
            <Link key={a.id} to={`/student/attempt/${a.id}`} className="row-link">
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontWeight: 500 }}>{a.exam.title}</strong>
                <span className="small muted mono">
                  {new Date(a.finishedAt).toLocaleDateString('mn-MN')} · {a.mode === 'TIMED' ? 'цагтай' : 'дадлага'}
                  {' '}· {a.score}/{a.totalPoints} оноо
                </span>
              </span>
              <span className="badge mono" style={{ borderColor: pct >= 60 ? 'var(--ok)' : 'var(--accent)', color: pct >= 60 ? 'var(--ok)' : 'var(--accent)' }}>
                {pct}%
              </span>
            </Link>
          );
        })}
      </div>
      <Link to="/student/dashboard" className="btn secondary small">График харах →</Link>
    </>
  );
}
