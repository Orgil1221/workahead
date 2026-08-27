import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

export default function StudentHome() {
  const [courses, setCourses] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api('/catalog')
      .then((d) => {
        // Нүүр дээр зөвхөн ХИЧЭЭЛүүд харагдана — 41 баталгаат МЭРГЭЖЛИЙГ л нууна.
        // Админаас шинээр нэмсэн хичээл шууд энд гарч ирнэ (шалгалтгүй байсан ч).
        const MAJOR_SCHOOLS = ['МТЭС', 'БС', 'ХЗС', 'ШУС', 'ИТС', 'УТСОУХНУС'];
        const list = d.universities.flatMap((u) =>
          u.programs.map((p) => ({ ...p, university: u }))
        ).filter((p) => !MAJOR_SCHOOLS.includes(p.school));
        setCourses(list);
      })
      .catch(() => {});
  }, []);

  if (!courses) return <Spinner />;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? courses.filter((c) =>
        `${c.code || ''} ${c.name} ${c.university.shortName || ''} ${c.university.name}`
          .toLowerCase()
          .includes(q)
      )
    : courses;

  return (
    <>
      <div className="hero">
        <div className="kicker mono">Улирлын · Явцын шалгалт</div>
        <h1 className="hero-title">
          Монгол Улсын Их Сургуулийн шалгалтад&nbsp;бэлтгэж буй <em>оюутнуудад зориулав</em>
        </h1>
        <p className="hero-sub muted">
          Бодит шалгалтын асуултууд, иж бүрэн шийдэл, дасгал тест — нэг дор.
        </p>
      </div>

      <div className="page-title-row"><h2>Хичээлүүд</h2></div>
      {courses.length > 3 && (
        <input
          className="course-search"
          placeholder="Хичээлийн код эсвэл нэрээр хайх…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {filtered.map((c) => (
        <div className="card clickable" key={c.id}>
          <Link to={`/student/p/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div className="course-row">
              <span className="course-code mono">{c.code || '—'}</span>
              <span style={{ minWidth: 0 }}>
                <h3 className="course-name" style={{ marginBottom: 4 }}>{c.name}</h3>
                <span className="small muted mono">
                  {c.university.shortName || c.university.name} · {c._count.exams} шалгалт
                </span>
              </span>
            </div>
          </Link>
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="empty-state">{q ? 'Илэрц олдсонгүй.' : 'Хичээл бүртгэлэгдээгүй байна.'}</div>
      )}
    </>
  );
}
