import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import FlagModal from '../../components/FlagModal.jsx';
import MathText from '../../components/MathText.jsx';
import 'mathlive';
import { useToast } from '../../context/ToastContext.jsx';

export default function AttemptRunner() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId → { given, earned }
  const [flagging, setFlagging] = useState(null);
  const [bookmarks, setBookmarks] = useState({});
  const [finished, setFinished] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradeStep, setGradeStep] = useState(0);

  const GRADING_STEPS = [
    'Бодолтуудыг илгээж байна…',
    'AI асуултуудыг уншиж байна…',
    'Оноо гаргаж байна…',
    'Иж бүрэн тайлбар бичиж байна…',
  ];
  useEffect(() => {
    if (!grading) { setGradeStep(0); return; }
    const t = setInterval(() => setGradeStep((s) => (s + 1) % GRADING_STEPS.length), 3500);
    return () => clearInterval(t);
  }, [grading]);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const toast = useToast();

  // Load the attempt
  useEffect(() => {
    api(`/attempts/${attemptId}`).then((d) => {
      setAttempt(d.attempt);
      if (d.attempt.finishedAt) setFinished(true);
    }).catch(() => {});
  }, [attemptId]);

  // Load exam questions once we know the attempt
  useEffect(() => {
    if (!attempt) return;
    api(`/exams/${attempt.examId}`)
      .then((d) => setQuestions(d.exam.questions))
      .catch(() => {});
    api('/bookmarks')
      .then((d) => setBookmarks(Object.fromEntries(d.bookmarks.map((b) => [b.question.id, true]))))
      .catch(() => {});
  }, [attempt]);

  // Timer — зөвхөн Задгай (TIMED) горимд
  useEffect(() => {
    if (!attempt || finished) return;
    if (attempt.mode !== 'TIMED') return;
    const started = new Date(attempt.startedAt).getTime();
    const durationMs = (attempt.exam?.durationMin ?? 90) * 60000;
    setSecondsLeft(Math.max(0, Math.floor((started + durationMs - Date.now()) / 1000)));
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(t); finish(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, finished]);

  const isTest = attempt?.mode === 'TEST' || attempt?.format === 'TEST';
  const isZadgai = attempt?.mode === 'TIMED';
  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;

  // MathLive <math-field> — зөвхөн Задгайд
  const mfRef = useRef(null);
  const qid = q?.id;
  useEffect(() => {
    if (isTest) return;
    const mf = mfRef.current;
    if (!mf || !qid) return;
    mf.value = answers[qid]?.given ?? '';
    let timer;
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => changeAnswer(qid, mf.getValue('latex')), 500);
    };
    mf.addEventListener('input', onInput);
    return () => {
      clearTimeout(timer);
      mf.removeEventListener('input', onInput);
    };
  }, [qid, isTest]);

  const saveTimers = useRef({});
  const saveAnswer = (qid, given) =>
    api(`/attempts/${attemptId}/answers`, { method: 'POST', body: { questionId: qid, givenAnswer: given } })
      .then((d) => {
        // TEST-д шууд оноо шинэчлэх
        if (d.answer) {
          setAnswers((a) => ({ ...a, [qid]: { ...(a[qid] || {}), given, earned: d.answer.pointsEarned, isCorrect: d.answer.isCorrect } }));
        }
      })
      .catch((e) => toast(e.message));

  const changeAnswer = (qid, value) => {
    setAnswers((a) => ({ ...a, [qid]: { ...(a[qid] ?? { earned: 0 }), given: value } }));
    clearTimeout(saveTimers.current[qid]);
    saveTimers.current[qid] = setTimeout(() => saveAnswer(qid, value), 700);
  };

  const selectTestChoice = (choiceKey) => {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: { ...(a[q.id] || {}), given: choiceKey } }));
    saveAnswer(q.id, choiceKey);
  };

  const toggleBookmark = async (qid) => {
    try {
      if (bookmarks[qid]) { await api(`/bookmarks/${qid}`, { method: 'DELETE' }); setBookmarks((b) => { const n = { ...b }; delete n[qid]; return n; }); }
      else { await api(`/bookmarks/${qid}`, { method: 'POST' }); setBookmarks((b) => ({ ...b, [qid]: true })); }
    } catch (e) { toast(e.message); }
  };

  const finish = async () => {
    if (grading) return;
    try {
      setGrading(true);
      await Promise.all(
        Object.entries(answers)
          .filter(([, a]) => a?.given?.trim())
          .map(([qid, a]) => api(`/attempts/${attemptId}/answers`, { method: 'POST', body: { questionId: qid, givenAnswer: a.given } }).catch(() => {}))
      );
      // Задгайд л AI дуудна, Тестэд шууд дуусгана
      if (!isTest) {
        await api(`/attempts/${attemptId}/ai-grade`, { method: 'POST' }).catch(() => {});
      }
      const d = await api(`/attempts/${attemptId}/finish`, { method: 'POST' });
      setFinished(true);
      return d.attempt;
    } catch (e) { toast(e.message); }
    finally { setGrading(false); }
  };

  const timeLabel = useMemo(() => {
    if (secondsLeft == null) return null;
    const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const s = String(secondsLeft % 60).padStart(2, '0');
    return `${m}:${s}`;
  }, [secondsLeft]);

  if (!attempt || (!questions.length && !finished)) return <Spinner />;

  if (finished) {
    return <ResultView attemptId={attemptId} onBack={() => window.location.assign('/student/history')} />;
  }

  return (
    <>
      {/* Header */}
      <div className="page-title-row">
        <div>
          <p className="small muted" style={{ margin: 0 }}>{attempt.exam.title} · <span className={`badge ${isTest ? 'blue' : ''}`} style={{ verticalAlign: 'middle' }}>{isTest ? 'Тест' : 'Задгай даалгавар'}</span></p>
          <h2 style={{ marginBottom: 0 }}>
            Асуулт <span className="mono">{idx + 1}</span>/{questions.length}
          </h2>
        </div>
        {timeLabel != null && (
          <span className={`timer-pill mono ${secondsLeft < 300 ? 'warn' : ''}`}>{timeLabel}</span>
        )}
        {timeLabel == null && (
          <button className="btn small" onClick={() => { finish().then(() => toast(isTest ? 'Тест дууслаа' : 'Задгай дууслаа')); }}>Дуусгах</button>
        )}
      </div>

      {/* Progress */}
      <div className="progress-track" style={{ marginBottom: 14 }}>
        <div className="progress-fill" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      {q && (
        <div className="card question-card">
          <span className="question-points mono">{q.points} оноо</span>
          <span className="question-num mono">№{q.order}</span>
          <span className="chip-row" style={{ marginLeft: 4 }}>
            {q.topic && <span className="badge blue">{q.topic}</span>}
            {(q.tags || []).filter((t) => t !== q.topic).slice(0, 2).map((t) => <span key={t} className="badge">{t}</span>)}
            {q.type === 'test' && <span className="badge blue">Тест</span>}
            {q.type === 'open' && <span className="badge">Задгай</span>}
          </span>
          <div className="q-prompt" style={{ margin: '10px 0' }}><MathText text={q.prompt} /></div>

          {isTest || q.type === 'test' ? (
            // TEST горим — 4 сонголт (dark/light аль алинд тод)
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {(q.choices || []).map((c) => {
                const selected = answers[q.id]?.given === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => selectTestChoice(c.key)}
                    className={`card ${selected ? 'selected' : ''}`}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      border: selected ? '2px solid var(--blue-ink)' : '1px solid var(--rule)',
                      background: selected ? 'color-mix(in srgb, var(--blue-ink) 10%, var(--paper-raised))' : 'var(--paper-raised)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      transition: 'all 0.15s',
                      color: 'var(--ink)',
                    }}
                  >
                    <span className={`mono`} style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: selected ? 'var(--blue-ink)' : 'transparent',
                      border: selected ? 'none' : '1px solid var(--rule)',
                      color: selected ? 'var(--paper)' : 'var(--ink-soft)',
                      fontWeight: 700, flexShrink: 0,
                    }}>{c.key}</span>
                    <span style={{ flex: 1, color: 'var(--ink)' }}><MathText text={c.text} /></span>
                    {selected && <span style={{ color: 'var(--blue-ink)', fontWeight: 700 }}>✓</span>}
                  </button>
                );
              })}
              {(!q.choices || q.choices.length === 0) && <p className="small faint">Сонголтууд ачааллаагүй байна.</p>}
            </div>
          ) : (
            // Задгай — math-field
            <>
              <div className="label-row">
                <label htmlFor={`ans-${q.id}`}>Таны бодолт / хариулт</label>
                <span className="faint small mono">LaTeX · $...$</span>
              </div>
              <math-field
                id={`ans-${q.id}`}
                ref={mfRef}
                class="answer-mathfield"
                virtual-keyboard-mode="onfocus"
              />
              <p className="small faint" style={{ marginTop: 10, marginBottom: 0 }}>
                Зөв хариулттай яг таарвал автоматаар бүтэн оноо өгнө, таараагүй бол AI таны бодолтыг уншиж оноо + тайлбар өгнө.
              </p>
            </>
          )}

          <hr className="divider-dashed" />
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <span className="btn-row">
              <button className="btn secondary small" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Өмнөх</button>
              <button className="btn secondary small"
                disabled={idx >= questions.length - 1} onClick={() => setIdx(idx + 1)}>Дараах →</button>
            </span>
            <span className="btn-row">
              <button className={`icon-btn ${bookmarks[q.id] ? 'active' : ''}`} title="Bookmark"
                onClick={() => toggleBookmark(q.id)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={bookmarks[q.id] ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.8"><path d="M6 3h12v18l-6-4-6 4V3z" /></svg>
              </button>
              <button className="icon-btn" title="Flag — алдаа мэдэгдэх" onClick={() => setFlagging(q)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 21V4m0 1h13l-3 4 3 4H5" /></svg>
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Question navigator dots */}
      <div className="btn-row" style={{ justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 6 }}>
        {questions.map((qq, i) => {
          const ans = answers[qq.id];
          const isSelected = i === idx;
          const isAnswered = !!ans?.given;
          return (
            <button key={qq.id} className={`btn small ${isSelected ? '' : isAnswered ? 'secondary' : 'ghost'}`}
              style={{ minWidth: 36, border: isAnswered && !isSelected ? '1px solid var(--blue-ink)' : undefined }}
              onClick={() => setIdx(i)}>
              {isAnswered ? '●' : i + 1}
            </button>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', paddingBottom: 16 }}>
        <button className="btn danger" disabled={grading} onClick={finish}>
          {grading ? (isTest ? 'Дүгнэж байна…' : 'AI үнэлж байна…') : isTest ? `Тестийг дуусгах (${answeredCount}/${questions.length} хариулсан)` : `Задгайг дуусгах (${answeredCount}/${questions.length} хариулсан)`}
        </button>
      </div>

      {grading && !isTest && (
        <div className="grading-overlay" role="status" aria-live="polite">
          <div className="card grading-card">
            <svg className="grading-ring" viewBox="0 0 50 50" width="64" height="64" aria-hidden="true">
              <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(216,208,189,.5)" strokeWidth="5" />
              <circle cx="25" cy="25" r="20" fill="none" stroke="var(--blue-ink)" strokeWidth="5"
                strokeLinecap="round" strokeDasharray="90 126" />
            </svg>
            <strong>AI бодолтыг үнэлж байна</strong>
            <p className="small muted" style={{ margin: '6px 0 10px' }}>{GRADING_STEPS[gradeStep]}</p>
            <span className="dots"><i /><i /><i /></span>
            <p className="faint small" style={{ margin: '8px 0 0' }}>
              Асуултын тооноос хамааран ~10–30 секунд зарцуулна
            </p>
          </div>
        </div>
      )}
      {grading && isTest && (
        <div className="grading-overlay" role="status" aria-live="polite">
          <div className="card grading-card">
            <strong>Тест дүгнэж байна…</strong>
            <p className="small muted">Шууд автоматаар шалгана</p>
          </div>
        </div>
      )}

      {flagging && <FlagModal question={flagging} onClose={() => setFlagging(null)} />}
      {timeLabel === '00:00' && null}
    </>
  );
}

function ResultView({ attemptId, onBack }) {
  const [data, setData] = useState(null);
  useEffect(() => { api(`/attempts/${attemptId}`).then((d) => setData(d.attempt)).catch(() => {}); }, [attemptId]);
  if (!data) return <Spinner />;

  const percent = data.totalPoints ? Math.round((data.score / data.totalPoints) * 100) : 0;
  const correct = data.answers.filter((a) => a.isCorrect).length;
  const isTest = data.mode === 'TEST' || data.format === 'TEST';

  return (
    <>
      <h1>Үр дүн <span className={`badge ${isTest ? 'blue' : ''}`} style={{ verticalAlign: 'middle', marginLeft: 8 }}>{isTest ? 'Тест' : 'Задгай даалгавар'}</span></h1>
      <div className="card" style={{ textAlign: 'center', padding: 28 }}>
        <div className="stat-value mono" style={{ fontSize: '2.4rem', color: percent >= 60 ? 'var(--ok)' : 'var(--accent)' }}>
          {data.score}/{data.totalPoints}
        </div>
        <p className="muted mono">{percent}% · {correct}/{data.answers.length} асуулт дээр оноо авсан</p>
        <div className="progress-track" style={{ marginTop: 10 }}>
          <div className={`progress-fill ${percent >= 80 ? 'high' : percent < 50 ? 'low' : ''}`} style={{ width: `${percent}%` }} />
        </div>
      </div>

      {data.answers.map((a) => {
        const q = a.question;
        const isQTest = q.type === 'test' || (Array.isArray(q.choices) && q.choices.length === 4);
        const hasChoices = Array.isArray(q.choices) && q.choices.length === 4;
        return (
          <div className="card" key={a.id}>
            <span className="question-num mono">№{q.order}</span>
            <span className="badge mono" style={{ float: 'right' }}>{a.pointsEarned}/{q.points} {a.isCorrect ? '✓' : '✗'}</span>
            {hasChoices && <span className="badge blue" style={{ float: 'right', marginRight: 6 }}>Тест</span>}
            <div
              className="small"
              style={{
                margin: '6px 0',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              <MathText text={q.prompt} />
            </div>
            {hasChoices ? (
              <>
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  {(q.choices || []).map((c) => {
                    const isGiven = a.givenAnswer === c.key;
                    const isCorrectKey = q.correctChoice === c.key;
                    return (
                      <span key={c.key} className="badge" style={{
                        justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 10px',
                        background: isCorrectKey ? 'color-mix(in srgb, var(--ok) 14%, transparent)' : isGiven && !isCorrectKey ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'var(--paper)',
                        border: isGiven || isCorrectKey ? '1px solid var(--rule)' : '1px solid transparent',
                        color: isCorrectKey ? 'var(--ink)' : isGiven ? 'var(--ink)' : 'var(--ink-soft)',
                        opacity: 1,
                      }}>
                        <span className="mono" style={{ marginRight: 2, color: isCorrectKey ? 'var(--ok)' : isGiven && !isCorrectKey ? 'var(--accent)' : 'var(--ink-faint)' }}>{c.key}.</span>
                        <span style={{ flex: 1, color: 'var(--ink)' }}><MathText text={c.text} /></span>
                        {isGiven && <span className="mono" style={{ marginLeft: 6, color: isCorrectKey ? 'var(--ok)' : 'var(--accent)' }}>{isCorrectKey ? '✓ таны хариулт (зөв)' : '✗ таны хариулт'}</span>}
                        {!isGiven && isCorrectKey && <span className="mono" style={{ marginLeft: 6, color: 'var(--ok)' }}>← зөв хариулт</span>}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {a.givenAnswer && <p className="faint small mono" style={{ margin: 0 }}>Бодолт: {a.givenAnswer.slice(0, 180)}</p>}
                {q.answer && <div className="small" style={{ marginTop: 6 }}><strong className="small">Зөв хариулт: </strong><MathText text={q.answer} /></div>}
                {q.modelSolution && <div className="small" style={{ marginTop: 4 }}><strong className="small">Бодолт: </strong><MathText text={q.modelSolution} /></div>}
                {a.feedback && (
                  <div className="small ai-feedback" style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(37,99,235,0.06)', borderRadius: 8 }}>
                    <strong className="small">{a.gradedBy === 'AUTO' ? 'Автомат: ' : 'AI үнэлгээ: '}</strong>
                    <MathText text={a.feedback} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <Link to="/student/dashboard" className="btn" style={{ marginRight: 8 }}>Дашбоард руу</Link>
      <button className="btn secondary" onClick={onBack}>Дүнгийн түүх рүү</button>
    </>
  );
}
