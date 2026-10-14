import { useParams } from 'react-router-dom';
import { useStudy, useStudyLoad } from './StudyContext.jsx';
import { CourseCards, StudyHeading, StudyState } from './StudyUI.jsx';

export default function University() {
  const { universityId } = useParams();
  const { request, base } = useStudy();
  const { data, loading, error, retry } = useStudyLoad(() => request('/catalog'), [request, universityId]);
  const university = data?.universities.find((item) => item.id === universityId);
  return <div className="sl-page">
    <StudyHeading back={{ to: base, label: 'Бүх хичээл' }} eyebrow="ИХ СУРГУУЛЬ" title={university?.name || 'Хичээлүүд'} description="Бэлтгэх хичээлээ сонгоно уу." />
    {loading || error ? <StudyState loading={loading} error={error} retry={retry} /> : university?.programs.length ? <CourseCards base={base} programs={university.programs.map((program) => ({ ...program, university }))} /> : <StudyState title="Хичээл олдсонгүй" description="Өөр сургууль эсвэл хичээл сонгоно уу." />}
  </div>;
}
