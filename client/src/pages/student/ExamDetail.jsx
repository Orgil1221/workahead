import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MathText from '../../components/MathText.jsx';
import { useStudy, useStudyLoad } from './StudyContext.jsx';
import { StudyHeading, StudyIcon, StudyState } from './StudyUI.jsx';

export default function ExamDetail() {
  const { examId } = useParams();
  const { request, base, preview } = useStudy();
  const navigate = useNavigate();
  const { data, loading, error, retry } = useStudyLoad(() => request('/exams/' + examId), [request, examId]);
  const [mode, setMode] = useState('TIMED');
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState('');
  const starting = useRef(false);
  const exam = data?.exam;
  const questions = exam?.questions || [];
  const hasTest = questions.some((question) => question.type === 'test' || (question.choices?.length >= 2 && question.choices?.length <= 4));
  async function start() {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setStartError('');
    try {
      const result = await request('/attempts', { method: 'POST', body: { examId, mode } });
      navigate(base + '/attempt/' + result.attempt.id);
    } catch (failure) {
      setStartError(failure.status === 403 ? 'Энэ шалгалтыг ажиллах эрх шаардлагатай. Суралцах багцаа шалгана уу.' : 'Шалгалт эхлүүлж чадсангүй. Дахин оролдоно уу.');
    } finally { starting.current = false; setBusy(false); }
  }
  return <div className="sl-page">
    <StudyHeading back={{ to: exam?.programId ? base + '/p/' + exam.programId : base, label: exam?.program?.name || 'Хичээлүүд' }} eyebrow={[exam?.year, exam?.variant && exam.variant + ' ХУВИЛБАР'].filter(Boolean).join(' / ') || 'ШАЛГАЛТЫН МЭДЭЭЛЭЛ'} title={exam?.title || 'Шалгалт'} description={exam?.program?.university?.name} />
    {loading ? <StudyState loading /> : error?.status === 403 ? <StudyState title="Суралцах эрх шаардлагатай" description="Энэ шалгалт багцад багтсан. Эрхээ шалгах эсвэл багцаа сонгоорой."><Link className="sl-button sl-button-green" to={preview ? '/preview/payment' : '/student/payment'}>Суралцах багц харах<StudyIcon name="arrow" size={17} /></Link></StudyState> : error ? <StudyState error={error} retry={retry} /> : !questions.length ? <StudyState title="Бодлого хараахан нэмэгдээгүй" description="Бодлогууд нэмэгдсэний дараа энэ шалгалтыг эхлүүлэх боломжтой." /> : <div className="sl-detail-grid">
      <section className="sl-card sl-panel">
        <h2>Хэрхэн ажиллах вэ?</h2><p className="sl-note">Өөрт тохирох горимоо сонгоод эхлүүлээрэй.</p>
        <div className="sl-stats"><div className="sl-stat"><strong>{questions.length}</strong><span>Бодлого</span></div><div className="sl-stat"><strong>{questions.reduce((total, question) => total + question.points, 0)}</strong><span>Нийт оноо</span></div><div className="sl-stat"><strong>{mode === 'TEST' ? '∞' : exam.durationMin ?? 90}</strong><span>{mode === 'TEST' ? 'Хугацаагүй' : 'Минут'}</span></div></div>
        <fieldset className="sl-modes" disabled={busy}><legend>Шалгалтын горим</legend>
          <label className="sl-mode"><input type="radio" name="exam-mode" value="TIMED" checked={mode === 'TIMED'} onChange={() => setMode('TIMED')} /><span><strong>Хугацаатай · Задгай хариулт</strong><small>Бодолтын хариугаа томьёогоор оруулна. Тест төрлийн бодлогод сонголтоор хариулна.</small></span></label>
          {hasTest && <label className="sl-mode"><input type="radio" name="exam-mode" value="TEST" checked={mode === 'TEST'} onChange={() => setMode('TEST')} /><span><strong>Хугацаагүй · Тест</strong><small>Сонголттой бодлогод A–D хариултаас сонгоно. Сонголтгүй бодлогод хариугаа бичнэ.</small></span></label>}
        </fieldset>
        {startError && <p className="sl-error" role="alert">{startError}</p>}
        <button className="sl-button sl-button-green sl-full" disabled={busy} onClick={start}>{busy ? 'Эхлүүлж байна…' : 'Шалгалт эхлүүлэх'}<StudyIcon name="arrow" size={18} /></button>
        <p className="sl-note">{mode === 'TIMED' ? 'Эхлүүлэхэд хугацаа тоологдоно. Хугацаа дуусахад хариултыг илгээнэ.' : 'Хугацаа тоолохгүй. Бүх бодлогоо шалгаад өөрөө дуусгана.'}</p>
      </section>
      <aside className="sl-card sl-panel"><div className="sl-eyebrow">АЖИЛЛАХ ДАРААЛАЛ</div><ol className="sl-steps"><li><span><strong>Бодлогоо ажиллах</strong>Асуултуудын хооронд чөлөөтэй шилжинэ.</span></li><li><span><strong>Хариултаа шалгах</strong>Хадгалалтын төлөв болон хариулаагүй бодлогоо харна.</span></li><li><span><strong>Дүнгээ харах</strong>Оноо, зөв хариу, боломжтой тайлбаруудыг харьцуулна.</span></li></ol></aside>
    </div>}
    {!loading && !error && questions.length > 0 && <details className="sl-question-preview"><summary>Бодлогуудыг урьдчилан харах · {questions.length}</summary>{questions.map((question, index) => <div key={question.id} className="sl-preview-question"><span>{String(index + 1).padStart(2, '0')}</span><div className="sl-math"><MathText text={question.prompt} /></div></div>)}</details>}
  </div>;
}
