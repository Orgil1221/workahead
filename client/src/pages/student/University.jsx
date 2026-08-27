import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

export default function UniversityPage() {
  const { universityId } = useParams();
  const [universities, setUniversities] = useState(null);
  const uni = universities?.find((u) => u.id === universityId);

  useEffect(() => { api('/catalog').then((d) => setUniversities(d.universities)).catch(() => {}); }, []);

  if (!universities) return <Spinner />;
  if (!uni) return <p className="muted">Сургууль олдсонгүй.</p>;

  return (
    <>
      <div className="page-title-row">
        <h1>{uni.name}</h1>
        <Link to="/student" className="btn secondary small">← Сургууль руу</Link>
      </div>
      <div className="card" style={{ padding: '4px 16px' }}>
        {uni.programs.map((p) => (
          <Link key={p.id} to={`/student/p/${p.id}`} className="row-link">
            <span>
              <strong style={{ display: 'block' }}>{p.name}</strong>
              <span className="small muted mono">{p._count.exams} шалгалт</span>
            </span>
            <span aria-hidden>→</span>
          </Link>
        ))}
        {uni.programs.length === 0 && <div className="empty-state">Хөтөлбөр байхгүй.</div>}
      </div>
    </>
  );
}
