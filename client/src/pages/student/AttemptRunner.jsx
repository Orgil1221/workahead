import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import MathText from '../../components/MathText.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useStudy, useStudyLoad } from './StudyContext.jsx';
import { StudyDialog, StudyIcon, StudyState } from './StudyUI.jsx';
import StudyResult from './StudyResult.jsx';
import 'mathlive';

function MathAnswer({ questionId, initialValue, disabled, onChange }) {
  const fieldRef = useRef(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => {
    const field = fieldRef.current;
    field.value = initialValue || '';
    const handleInput = () => changeRef.current(field.getValue('latex'));
    field.addEventListener('input', handleInput);
    return () => field.removeEventListener('input', handleInput);
  }, [questionId]);
  useEffect(() => { fieldRef.current.readOnly = disabled; }, [disabled]);
  return <><label className="sl-answer-label" htmlFor={'answer-' + questionId}>Таны бодолт / хариулт</label><math-field ref={fieldRef} id={'answer-' + questionId} aria-label="Таны бодолт / хариулт" virtual-keyboard-mode="onfocus" /><p className="sl-note">Томьёоны гараар эсвэл өөрийн гараар хариултаа оруулна уу.</p></>;
}

export default function AttemptRunner() {
  const { attemptId } = useParams();
  const { request } = useStudy();
  const { data, loading, error, retry } = useStudyLoad(async () => {
    const result = await request('/attempts/' + attemptId);
    if (result.attempt.finishedAt) return result;
    const exam = await request('/exams/' + result.attempt.examId + '?attemptId=' + attemptId);
    return { ...result, questions: exam.exam.questions };
  }, [request, attemptId]);
  if (loading || error) return <div className="sl-page"><StudyState loading={loading} error={error} retry={retry} /></div>;
  if (data.attempt.finishedAt) return <StudyResult attemptId={attemptId} initialAttempt={data.attempt} />;
  if (!data.questions.length) return <div className="sl-page"><StudyState title="Шалгалтын бодлого олдсонгүй" /></div>;
  return <ActiveAttempt key={attemptId} attempt={data.attempt} questions={data.questions} />;
}

function ActiveAttempt({ attempt, questions }) {
  const { request } = useStudy();
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => Object.fromEntries((attempt.answers || []).map((answer) => [answer.questionId || answer.question.id, answer.givenAnswer || ''])));
  const answersRef = useRef(answers);
  const persistedRef = useRef({ ...answers });
  const timers = useRef({});
  const queues = useRef({});
  const [saveStates, setSaveStates] = useState({});
  const [bookmarks, setBookmarks] = useState(() => Object.fromEntries(questions.map((question) => [question.id, !!question.bookmarked])));
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const bookmarkLock = useRef(false);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const reportLock = useRef(false);
  const [finishing, setFinishing] = useState(false);
  const finishLock = useRef(false);
  const [finishError, setFinishError] = useState('');
  const [stage, setStage] = useState('');
  const [finished, setFinished] = useState(false);
  const [gradingNotice, setGradingNotice] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);
  const autoFinished = useRef(false);
  const finishRef = useRef(null);
  const question = questions[index];
  const isTest = attempt.mode === 'TEST' || attempt.format === 'TEST';
  const hasChoices = question.type === 'test' || (isTest && question.choices?.length === 4);
  const answeredCount = questions.filter((item) => answers[item.id]?.trim()).length;
  const expired = secondsLeft === 0;
  const locked = finishing || expired;
  const saveState = saveStates[question.id] || (answers[question.id] ? 'saved' : 'empty');

  function queueSave(questionId, value) {
    const previous = queues.current[questionId] || Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      if (persistedRef.current[questionId] !== value) {
        await request('/attempts/' + attempt.id + '/answers', { method: 'POST', body: { questionId, givenAnswer: value } });
        persistedRef.current[questionId] = value;
      }
      if (answersRef.current[questionId] === value) setSaveStates((current) => ({ ...current, [questionId]: 'saved' }));
    }).catch((error) => {
      if (answersRef.current[questionId] === value) setSaveStates((current) => ({ ...current, [questionId]: 'error' }));
      throw error;
    });
    queues.current[questionId] = pending;
    return pending;
  }

  function changeAnswer(questionId, value, immediate = false) {
    if (finishLock.current || expired) return;
    answersRef.current = { ...answersRef.current, [questionId]: value };
    setAnswers(answersRef.current);
    setSaveStates((current) => ({ ...current, [questionId]: 'pending' }));
    clearTimeout(timers.current[questionId]);
    if (immediate) queueSave(questionId, value).catch(() => {});
    else timers.current[questionId] = setTimeout(() => queueSave(questionId, value).catch(() => {}), 600);
  }

  function navigateQuestion(nextIndex) {
    clearTimeout(timers.current[question.id]);
    if (answersRef.current[question.id] !== undefined) queueSave(question.id, answersRef.current[question.id]).catch(() => {});
    setIndex(nextIndex);
    document.querySelector('.sl-question-top')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  useEffect(() => {
    const warnUnsaved = (event) => {
      if (finishLock.current || Object.entries(answersRef.current).some(([questionId, value]) => persistedRef.current[questionId] !== value)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => {
      window.removeEventListener('beforeunload', warnUnsaved);
      Object.values(timers.current).forEach(clearTimeout);
      if (!finishLock.current) Object.entries(answersRef.current).forEach(([questionId, value]) => {
        if (persistedRef.current[questionId] !== value) queueSave(questionId, value).catch(() => {});
      });
    };
  }, []);

  useEffect(() => {
    if (attempt.mode !== 'TIMED' || finished) return;
    const deadline = new Date(attempt.startedAt).getTime() + (attempt.exam?.durationMin ?? 90) * 60000;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt, finished]);

  useEffect(() => {
    if (secondsLeft === 0 && !autoFinished.current && !finished) {
      autoFinished.current = true;
      finishRef.current();
    }
  }, [secondsLeft, finished]);

  async function finish() {
    if (finishLock.current) return;
    finishLock.current = true;
    setFinishing(true);
    setDialog('finish');
    setFinishError('');
    setStage('Хариултуудыг хадгалж байна…');
    try {
      Object.values(timers.current).forEach(clearTimeout);
      const saves = Object.entries(answersRef.current).map(([questionId, value]) => queueSave(questionId, value));
      const results = await Promise.allSettled(saves);
      if (results.some((result) => result.status === 'rejected')) throw new Error('SAVE_FAILED');
      if (!isTest) {
        setStage('Бодолтын үнэлгээг хүлээж байна…');
        try {
          const grading = await request('/attempts/' + attempt.id + '/ai-grade', { method: 'POST' });
          if (!grading.enabled) setGradingNotice('AI үнэлгээ боломжгүй байсан тул одоогийн автомат үнэлгээг харуулж байна.');
        } catch { setGradingNotice('AI үнэлгээ авахад алдаа гарсан. Одоогийн автомат үнэлгээг харуулж байна.'); }
      }
      setStage('Дүнг нэгтгэж байна…');
      await request('/attempts/' + attempt.id + '/finish', { method: 'POST' });
      setFinished(true);
      setDialog(null);
    } catch (error) {
      setFinishError(error.message === 'SAVE_FAILED' ? 'Зарим хариулт хадгалагдаагүй тул шалгалтыг дуусгасангүй. Холболтоо шалгаад дахин оролдоорой.' : 'Шалгалтыг дуусгаж чадсангүй. Хариултууд хадгалагдсан; дахин оролдоно уу.');
    } finally { finishLock.current = false; setFinishing(false); }
  }
  finishRef.current = finish;

  async function toggleBookmark() {
    if (bookmarkLock.current) return;
    bookmarkLock.current = true;
    setBookmarkBusy(true);
    const questionId = question.id;
    const saved = bookmarks[questionId];
    try {
      await request('/bookmarks/' + questionId, { method: saved ? 'DELETE' : 'POST' });
      setBookmarks((current) => ({ ...current, [questionId]: !saved }));
      toast(saved ? 'Хадгалсан бодлогоос хаслаа' : 'Бодлогыг хадгаллаа');
    } catch { toast('Бодлогыг хадгалж чадсангүй. Дахин оролдоно уу.'); }
    finally { bookmarkLock.current = false; setBookmarkBusy(false); }
  }

  async function report(event) {
    event.preventDefault();
    if (!reason.trim() || reportLock.current) return;
    reportLock.current = true;
    setReportBusy(true);
    setReportError('');
    try {
      await request('/flags', { method: 'POST', body: { questionId: question.id, reason: reason.trim() } });
      setDialog(null);
      setReason('');
      toast('Мэдээллийг илгээлээ. Баярлалаа.');
    } catch { setReportError('Илгээж чадсангүй. Дахин оролдоно уу.'); }
    finally { reportLock.current = false; setReportBusy(false); }
  }

  if (finished) return <StudyResult attemptId={attempt.id} gradingNotice={gradingNotice} />;
  const timeLabel = secondsLeft === null ? '—' : String(Math.floor(secondsLeft / 60)).padStart(2, '0') + ':' + String(secondsLeft % 60).padStart(2, '0');
  return <div className="sl-page">
    <header className="sl-run-top"><div><div className="sl-eyebrow">{isTest ? 'ТЕСТ / ХУГАЦААГҮЙ' : 'ЗАДГАЙ / ХУГАЦААТАЙ'}</div><h1>{attempt.exam.title}</h1></div>{attempt.mode === 'TIMED' && <div className={'sl-timer' + (secondsLeft !== null && secondsLeft < 300 ? ' is-urgent' : '')} role="timer" aria-label={'Үлдсэн хугацаа ' + timeLabel}><StudyIcon name="clock" size={18} />{timeLabel}</div>}</header>
    {expired && <p className="sl-error" role="status">Хугацаа дууссан. Хадгалсан хариултуудаар дүнг гаргана.</p>}
    <div className="sl-run-grid">
      <section className="sl-card sl-question" aria-label="Одоогийн бодлого">
        <div className="sl-question-top"><div><h2>Бодлого {String(index + 1).padStart(2, '0')} <span className="sl-caption">/ {questions.length}</span></h2><span className="sl-caption">{question.topic || 'Бодлого'} · {question.points} оноо</span></div><div className="sl-actions"><button className="sl-icon-button" aria-label="Бодлого хадгалах" title="Бодлого хадгалах" aria-pressed={!!bookmarks[question.id]} disabled={bookmarkBusy || finishing} onClick={toggleBookmark}><StudyIcon name="bookmark" /></button><button className="sl-icon-button" aria-label="Алдаа мэдээлэх" title="Алдаа мэдээлэх" disabled={finishing} onClick={() => { setReportError(''); setDialog('report'); }}><StudyIcon name="flag" /></button></div></div>
        <div className="sl-math sl-question-prompt"><MathText text={question.prompt} /></div>
        {hasChoices && question.choices?.length === 4 ? <fieldset className="sl-choices" disabled={locked}><legend>Зөв хариултыг сонгоно уу.</legend>{question.choices.map((choice) => <label className="sl-choice" key={question.id + choice.key}><input type="radio" name={'choice-' + question.id} value={choice.key} checked={answers[question.id] === choice.key} onChange={() => changeAnswer(question.id, choice.key, true)} /><span className="sl-choice-letter">{choice.key}</span><span className="sl-math"><MathText text={choice.text} /></span>{answers[question.id] === choice.key && <StudyIcon name="check" size={18} />}</label>)}</fieldset> : hasChoices ? <p className="sl-error">Энэ тестийн сонголт дутуу байна. Алдаа мэдээлэх товчоор бидэнд мэдэгдэнэ үү.</p> : <MathAnswer key={question.id} questionId={question.id} initialValue={answers[question.id]} disabled={locked} onChange={(value) => changeAnswer(question.id, value)} />}
        <div className={'sl-save-status is-' + saveState} role="status">{saveState === 'saved' && <StudyIcon name="check" size={14} />}{saveState === 'saved' ? 'Хариулт хадгалагдсан' : saveState === 'pending' ? 'Хадгалж байна…' : saveState === 'error' ? 'Хадгалж чадсангүй.' : 'Хариултыг автоматаар хадгална.'}{saveState === 'error' && <button className="sl-button" disabled={finishing} onClick={() => queueSave(question.id, answersRef.current[question.id]).catch(() => {})}>Дахин хадгалах</button>}</div>
        <div className="sl-question-footer"><button className="sl-button" disabled={index === 0 || finishing} onClick={() => navigateQuestion(index - 1)}><StudyIcon name="back" size={16} />Өмнөх</button>{index < questions.length - 1 ? <button className="sl-button sl-button-primary" disabled={finishing} onClick={() => navigateQuestion(index + 1)}>Дараах<StudyIcon name="arrow" size={16} /></button> : <button className="sl-button sl-button-green" disabled={finishing} onClick={() => setDialog('finish')}>Дуусгах<StudyIcon name="check" size={16} /></button>}</div>
      </section>
      <aside className="sl-card sl-navigator"><div className="sl-row"><h2>Хариултын явц</h2><span className="sl-code">{answeredCount}/{questions.length}</span></div><div className="sl-progress" role="progressbar" aria-label="Хариулсан бодлого" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={questions.length}><span style={{ width: answeredCount / questions.length * 100 + '%' }} /></div><nav className="sl-question-numbers" aria-label="Бодлогын дугаар">{questions.map((item, position) => <button key={item.id} className={answers[item.id]?.trim() ? 'is-answered' : ''} aria-current={position === index ? 'step' : undefined} aria-label={'Бодлого ' + (position + 1) + (answers[item.id]?.trim() ? ', хариулсан' : ', хариулаагүй')} disabled={finishing} onClick={() => navigateQuestion(position)}>{position + 1}</button>)}</nav><div className="sl-legend"><span>Хариулсан</span><span>Хариулаагүй</span></div><button className="sl-button sl-button-primary sl-full" disabled={finishing} onClick={() => setDialog('finish')}>Шалгалт дуусгах</button><p className="sl-note">Дуусгахаас өмнө хариултаа өөрчилж болно.</p></aside>
    </div>
    {dialog === 'finish' && <StudyDialog title={finishing ? 'Шалгалтыг дуусгаж байна' : 'Шалгалтаа дуусгах уу?'} busy={finishing} onClose={() => setDialog(null)}><div className="sl-stats"><div className="sl-stat"><strong>{questions.length}</strong><span>Нийт</span></div><div className="sl-stat"><strong>{answeredCount}</strong><span>Хариулсан</span></div><div className="sl-stat"><strong>{questions.length - answeredCount}</strong><span>Хариулаагүй</span></div></div><p>{finishing ? stage : questions.length > answeredCount ? 'Хариулаагүй бодлогод оноо тооцохгүй. Дуусгасны дараа хариулт өөрчлөх боломжгүй.' : 'Бүх бодлогод хариулсан байна. Дуусгасны дараа дүн, зөв хариуг харуулна.'}</p>{finishError && <p className="sl-error" role="alert">{finishError}</p>}<div className="sl-actions"><button className="sl-button" disabled={finishing} onClick={() => setDialog(null)}>Буцах</button><button className="sl-button sl-button-green" disabled={finishing} onClick={finish}>{finishing ? 'Түр хүлээнэ үү…' : 'Дуусгаж, дүн харах'}</button></div></StudyDialog>}
    {dialog === 'report' && <StudyDialog title="Бодлогын алдаа мэдээлэх" busy={reportBusy} onClose={() => setDialog(null)}><form onSubmit={report}><label className="sl-note" htmlFor="study-report">Бодлого {index + 1} — ямар алдаа байгааг тайлбарлана уу.</label><textarea id="study-report" autoFocus required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Нөхцөл эсвэл хариултын алдаа…" />{reportError && <p className="sl-error" role="alert">{reportError}</p>}<div className="sl-actions"><button className="sl-button sl-button-green" disabled={reportBusy || !reason.trim()}>{reportBusy ? 'Илгээж байна…' : 'Мэдээлэл илгээх'}</button></div></form></StudyDialog>}
  </div>;
}
