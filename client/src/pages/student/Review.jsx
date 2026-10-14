import { useState } from 'react';
import { Link } from 'react-router-dom';
import MathText from '../../components/MathText.jsx';
import { useStudy, useStudyLoad } from './StudyContext.jsx';
import { StudyHeading, StudyState } from './StudyUI.jsx';

export default function Review() {
  const { request, base } = useStudy();
  const { data, loading, error, retry } = useStudyLoad(() => request('/attempts/practice/wrong'), [request]);
  const [solutions, setSolutions] = useState({});
  const [opened, setOpened] = useState({});
  async function reveal(questionId) {
    if (opened[questionId] && !solutions[questionId]?.error) {
      setOpened((current) => ({ ...current, [questionId]: false }));
      return;
    }
    setOpened((current) => ({ ...current, [questionId]: true }));
    if (solutions[questionId] && !solutions[questionId].error) return;
    setSolutions((current) => ({ ...current, [questionId]: { loading: true } }));
    try {
      const result = await request('/exams/solution/' + questionId);
      setSolutions((current) => ({ ...current, [questionId]: result }));
    } catch { setSolutions((current) => ({ ...current, [questionId]: { error: true } })); }
  }
  return <div className="sl-page">
    <StudyHeading back={{ to: base, label: 'Хичээлүүд' }} eyebrow="ДАВТЛАГА" title="Алдсан бодлогууд" description="Эхлээд өөрөө бодоод, дараа нь зөв хариу болон тайлбартай харьцуулаарай." />
    {loading || error ? <StudyState loading={loading} error={error} retry={retry} /> : !data.questions.length ? <StudyState title="Давтах бодлого алга" description="Шалгалтаар алдсан бодлогууд энд цугларна."><Link className="sl-button sl-button-green" to={base}>Шалгалт сонгох</Link></StudyState> : <><div className="sl-section-title"><span>{data.questions.length} бодлого</span></div><div className="sl-result-list">{data.questions.map((question, index) => <section className="sl-card sl-panel" key={question.id}><div className="sl-row"><span className="sl-code">{String(index + 1).padStart(2, '0')} / {question.topic || 'БОДЛОГО'}</span><span className="sl-chip">{question.points} оноо</span></div><div className="sl-math sl-question-prompt"><MathText text={question.prompt} /></div><p className="sl-note">{question.exam?.title}</p><button className="sl-button" aria-expanded={!!opened[question.id]} aria-controls={'solution-' + question.id} disabled={solutions[question.id]?.loading} onClick={() => reveal(question.id)}>{solutions[question.id]?.loading ? 'Ачаалж байна…' : solutions[question.id]?.error ? 'Дахин ачаалах' : opened[question.id] ? 'Тайлбарыг хураах' : 'Хариу, тайлбар харах'}</button>{opened[question.id] && <div id={'solution-' + question.id} className="sl-answer-detail">{solutions[question.id]?.error ? <p className="sl-error" role="alert">Бодолт ачаалж чадсангүй. Дахин оролдоно уу.</p> : solutions[question.id]?.loading ? <p role="status" className="sl-note">Бодолт ачаалж байна…</p> : <div className="sl-solution"><div className="sl-math"><MathText text={solutions[question.id]?.answer || solutions[question.id]?.correctChoice || ''} /></div><div className="sl-math"><MathText text={solutions[question.id]?.modelSolution || 'Бодолтын тайлбар хараахан нэмэгдээгүй.'} /></div></div>}</div>}</section>)}</div></>}
  </div>;
}
