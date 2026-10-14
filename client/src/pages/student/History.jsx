import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudy, useStudyLoad } from './StudyContext.jsx';
import { StudyHeading, StudyIcon, StudyState } from './StudyUI.jsx';

export default function History() {
  const { request, base } = useStudy();
  const { data, loading, error, retry } = useStudyLoad(() => request('/attempts/history/list'), [request]);
  const [filter, setFilter] = useState('all');
  const attempts = data?.attempts || [];
  const filtered = attempts.filter((attempt) => filter === 'all' || attempt.mode === filter);
  return <div className="sl-page">
    <StudyHeading eyebrow="МИНИЙ СУРАЛЦАХ ЯВЦ" title="Дүнгийн түүх" description="Ажилласан шалгалт, хариулт, бодолтын тайлбараа дахин хараарай." />
    {loading || error ? <StudyState loading={loading} error={error} retry={retry} /> : <>
      <div className="sl-section-title"><span>{filtered.length} оролдлого</span><div className="sl-filter" aria-label="Шалгалтын горим">{[['all', 'Бүгд'], ['TEST', 'Тест'], ['TIMED', 'Задгай']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
      <div className="sl-exam-list">{filtered.map((attempt) => {
        const percent = attempt.totalPoints ? Math.round(attempt.score / attempt.totalPoints * 100) : 0;
        return <Link key={attempt.id} className="sl-card sl-exam" to={base + '/attempt/' + attempt.id}><div className="sl-exam-info"><h3>{attempt.exam.title}</h3><div className="sl-exam-meta"><span>{new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(attempt.finishedAt))}</span><span className="sl-chip">{attempt.mode === 'TEST' ? 'Тест' : 'Задгай'}</span></div></div><div className="sl-history-score"><strong>{percent}%</strong><small>{attempt.score}/{attempt.totalPoints} оноо</small></div><StudyIcon name="arrow" size={16} /></Link>;
      })}</div>
      {!filtered.length && <StudyState title="Шалгалтын дүн алга" description={filter === 'all' ? 'Эхний шалгалтаа ажиллахад таны дүн энд хадгалагдана.' : 'Энэ горимоор ажилласан шалгалт байхгүй байна.'}><Link className="sl-button sl-button-green" to={base}>Хичээл сонгох<StudyIcon name="arrow" size={16} /></Link></StudyState>}
    </>}
  </div>;
}
