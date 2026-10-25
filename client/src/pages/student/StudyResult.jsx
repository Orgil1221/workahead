import { useState } from 'react';
import { Link } from 'react-router-dom';
import MathText from '../../components/MathText.jsx';
import { useStudy, useStudyLoad } from './StudyContext.jsx';
import { StudyHeading, StudyIcon, StudyState } from './StudyUI.jsx';

export default function StudyResult({ attemptId, initialAttempt, gradingNotice }) {
  const { request, base } = useStudy();
  const { data, loading, error, retry } = useStudyLoad(() => initialAttempt ? Promise.resolve({ attempt: initialAttempt }) : request('/attempts/' + attemptId), [request, attemptId, initialAttempt]);
  const [filter, setFilter] = useState('all');
  const attempt = data?.attempt;
  if (loading || error) return <div className="sl-page"><StudyState loading={loading} error={error} retry={retry} /></div>;
  const percent = attempt.totalPoints ? Math.round(attempt.score / attempt.totalPoints * 100) : 0;
  const answers = [...(attempt.answers || [])].sort((first, second) => first.question.order - second.question.order);
  const answered = answers.filter((answer) => answer.givenAnswer?.trim()).length;
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const filtered = answers.filter((answer) => filter === 'all' || (filter === 'correct' ? answer.isCorrect : !answer.isCorrect));
  const isTest = attempt.mode === 'TEST' || attempt.format === 'TEST';
  return <div className="sl-page">
    <StudyHeading back={{ to: base + '/history', label: 'Дүнгийн түүх' }} eyebrow={isTest ? 'ТЕСТ / ҮР ДҮН' : 'ЗАДГАЙ / ҮР ДҮН'} title="Шалгалтын дүн" description={attempt.exam.title} />
    <section className="sl-card sl-result-hero">
      <div className="sl-score-ring" style={{ '--score': Math.max(0, Math.min(100, percent)) + '%' }} aria-label={'Авсан оноо ' + percent + ' хувь'}><div><strong>{percent}%</strong><span>Гүйцэтгэл</span></div></div>
      <div><div className="sl-eyebrow">ШАЛГАЛТ ДУУССАН</div><h2>{attempt.score} / {attempt.totalPoints} оноо</h2><p>Зөв хариу болон бодолтоо харьцуулж, алдсан хэсгээ давтаарай.</p><div className="sl-actions"><Link className="sl-button sl-button-green" to={base + '/exam/' + attempt.examId}>Дахин ажиллах<StudyIcon name="arrow" size={16} /></Link><Link className="sl-button" to={base + '/review'}>Алдсан бодлого</Link></div></div>
    </section>
    {gradingNotice && <p className="sl-error" role="status">{gradingNotice}</p>}
    <div className="sl-stats"><div className="sl-stat"><strong>{answered}</strong><span>Илгээсэн хариулт</span></div><div className="sl-stat"><strong>{correct}</strong><span>Зөв хариулт</span></div><div className="sl-stat"><strong>{isTest ? 'Тест' : 'Задгай'}</strong><span>Ажилласан горим</span></div></div>
    <div className="sl-section-title"><h2>Хариултын дэлгэрэнгүй</h2><div className="sl-filter" aria-label="Хариултын төлөв">{[['all', 'Бүгд', answers.length], ['wrong', 'Давтах', answers.length - correct], ['correct', 'Зөв', correct]].map(([value, label, count]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} · {count}</button>)}</div></div>
    <p className="sl-note">Илгээсэн хариултуудыг харуулж байна. Хариулаагүй бодлого нийт оноонд багтана, авах оноо нь 0.</p>
    <div className="sl-result-list">{filtered.map((answer) => {
      const question = answer.question;
      const choiceQuestion = question.type === 'test' || (isTest && question.choices?.length >= 2 && question.choices?.length <= 4);
      const givenChoice = question.choices?.find((choice) => choice.key === answer.givenAnswer?.trim().toUpperCase());
      const correctChoice = question.choices?.find((choice) => choice.key === question.correctChoice);
      return <details className="sl-card sl-answer-review" key={answer.id || question.id}><summary><span className={'sl-chip ' + (answer.isCorrect ? 'sl-chip-green' : 'sl-chip-red')}>{question.order}. {answer.isCorrect ? 'Зөв' : 'Давтах'}</span><div className="sl-math"><MathText text={question.prompt} /></div><span className="sl-answer-score">{answer.pointsEarned}/{question.points} оноо <span aria-hidden="true">⌄</span></span></summary><div className="sl-answer-detail"><div><h3>Таны хариулт</h3><div className="sl-math"><MathText text={choiceQuestion ? givenChoice ? givenChoice.key + '. ' + givenChoice.text : answer.givenAnswer || 'Хариулаагүй' : answer.givenAnswer ? answer.givenAnswer.includes('$') ? answer.givenAnswer : '$' + answer.givenAnswer + '$' : 'Хариулаагүй'} /></div></div>
        {(correctChoice || question.answer || question.modelSolution) && <div className="sl-solution">{(correctChoice || question.answer) && <><h3>Зөв хариулт</h3><div className="sl-math"><MathText text={choiceQuestion && correctChoice ? correctChoice.key + '. ' + correctChoice.text : question.answer} /></div></>}{question.modelSolution && <><h3>Бодолтын тайлбар</h3><div className="sl-math"><MathText text={question.modelSolution} /></div></>}</div>}
        {answer.feedback && <div><h3>{answer.gradedBy === 'AI' ? 'AI үнэлгээний тайлбар' : 'Үнэлгээний тайлбар'}</h3><div className="sl-math"><MathText text={answer.feedback} /></div></div>}
      </div></details>;
    })}</div>
    {!filtered.length && <StudyState title={filter === 'wrong' ? 'Давтах хариулт алга' : filter === 'correct' ? 'Зөв хариулт бүртгэгдээгүй' : 'Илгээсэн хариулт байхгүй'} description="Өөр шүүлтүүр сонгох эсвэл шалгалтаа дахин ажиллаарай." />}
  </div>;
}
