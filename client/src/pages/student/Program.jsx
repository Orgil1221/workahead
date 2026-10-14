import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStudy, useStudyLoad } from './StudyContext.jsx';
import { StudyHeading, StudyIcon, StudyState } from './StudyUI.jsx';

const groups = ['Улирлын шалгалт', 'Явцын шалгалт', 'Бусад'];
function examGroup(exam) {
  const title = (exam.title + ' ' + (exam.source || '')).toLocaleLowerCase();
  return title.includes('улирлын') ? groups[0] : title.includes('явцын') ? groups[1] : groups[2];
}
export default function Program() {
  const { programId } = useParams();
  const { request, base } = useStudy();
  const [year, setYear] = useState('all');
  const { data, loading, error, retry } = useStudyLoad(async () => {
    const [catalog, result] = await Promise.all([request('/catalog'), request('/programs/' + programId + '/exams')]);
    const university = catalog.universities.find((item) => item.programs.some((program) => program.id === programId));
    return { ...result, university, program: university?.programs.find((program) => program.id === programId) };
  }, [request, programId]);
  const years = [...new Set((data?.exams || []).map((exam) => exam.year).filter(Boolean))].sort((first, second) => second - first);
  const exams = (data?.exams || []).filter((exam) => year === 'all' || String(exam.year) === year).sort((first, second) => (second.year || 0) - (first.year || 0));

  return <div className="sl-page">
    <StudyHeading back={{ to: base, label: 'Хичээлүүд' }} eyebrow={data?.program?.code || 'ХИЧЭЭЛИЙН ШАЛГАЛТУУД'} title={data?.program?.name || 'Шалгалтууд'} description={data?.university ? data.university.name : 'Ажиллах шалгалтаа сонгоно уу.'} />
    {loading || error ? <StudyState loading={loading} error={error} retry={retry} /> : <>
      <div className="sl-section-title"><h2>Шалгалт сонгох <span className="sl-caption">/ {exams.length}</span></h2><div className="sl-filter" aria-label="Шалгалтын жил"><button aria-pressed={year === 'all'} onClick={() => setYear('all')}>Бүгд</button>{years.map((value) => <button key={value} aria-pressed={year === String(value)} onClick={() => setYear(String(value))}>{value}</button>)}</div></div>
      {!exams.length && <StudyState title="Шалгалт хараахан нэмэгдээгүй" description="Энэ хичээлийн шалгалтууд энд харагдана." />}
      {groups.map((group) => {
        const items = exams.filter((exam) => examGroup(exam) === group);
        return items.length > 0 && <section key={group}><div className="sl-section-title"><span>{group} · {items.length}</span></div><div className="sl-exam-list">{items.map((exam, index) => <Link className="sl-card sl-exam" to={base + '/exam/' + exam.id} key={exam.id}><span className="sl-exam-num">{String(index + 1).padStart(2, '0')}</span><div className="sl-exam-info"><h3>{exam.title}</h3><div className="sl-exam-meta">{exam.year && <span>{exam.year} он{exam.variant ? ' · ' + exam.variant + ' хувилбар' : ''}</span>}<span>{exam._count?.questions ?? 0} бодлого</span>{exam.durationMin > 0 && <span>{exam.durationMin} минут</span>}<span className={'sl-chip' + (exam.isFree ? ' sl-chip-green' : '')}>{exam.isFree ? 'Үнэгүй' : 'Багцын шалгалт'}</span></div></div><span className="sl-circle"><StudyIcon name="arrow" size={17} /></span></Link>)}</div></section>;
      })}
    </>}
  </div>;
}
