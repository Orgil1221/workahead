import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import MathText from '../../components/MathText.jsx';

export default function ExamDetail() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api(`/exams/${examId}`).then((d) => setExam(d.exam)).catch((e) => setError(e.message));
  }, [examId]);

  const start = async (mode) => {
    setBusy(true);
    try {
      const d = await api('/attempts', { method: 'POST', body: { examId, mode } });
      navigate(`/student/attempt/${d.attempt.id}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (error) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <h2>Хандалт хязгаарлагдсан</h2>
        <p className="muted">{error}</p>
        <Link to="/student/profile" className="btn">Багц худалдаж авах</Link>
      </div>
    );
  }

  if (!exam) return <Spinner />;

  const totalPoints = exam.questions.reduce((s, q) => s + q.points, 0);
  const hasTestChoices = exam.questions.some((q) => q.choices && Array.isArray(q.choices) && q.choices.length === 4);

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            {exam.program?.university?.name} · {exam.program?.name}
          </p>
          <h1 style={{ marginBottom: 0 }}>{exam.title}</h1>
        </div>
        <Link to={`/student/p/${exam.programId}`} className="btn secondary small">←</Link>
      </div>

      <div className="card">
        <span className="chip-row" style={{ marginBottom: 10 }}>
          <span className="badge blue mono">{exam.year}</span>
          {exam.variant && <span className="badge mono">{exam.variant}</span>}
          <span className="badge mono">{exam.questions.length} асуулт</span>
          <span className="badge mono">{totalPoints} оноо</span>
        </span>
        {exam.source && <p className="small muted" style={{ margin: 0 }}>{exam.source}</p>}

        <hr className="divider-dashed" />
        <h3 style={{ marginBottom: 8 }}>Горим сонгох</h3>
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={() => start('TIMED')}>
            <span style={{ fontSize: '1.1em', marginRight: 6 }}>✎</span> Задгай даалгавар
          </button>
          <button className="btn secondary" disabled={busy || !hasTestChoices} onClick={() => start('TEST')} title={!hasTestChoices ? 'Энэ шалгалтад тест сонголт оруулаагүй — зөвхөн Задгай боломжтой' : undefined}>
            <span style={{ fontSize: '1.1em', marginRight: 6 }}>☑</span> Тест
          </button>
        </div>
        {!hasTestChoices && <p className="small" style={{ marginTop: 8, marginBottom: 0, color: 'var(--warn)' }}>Энэ шалгалтад тест сонголт (4 хариулт) оруулаагүй тул Тест горим идэвхгүй — зөвхөн Задгай даалгавараар ажиллах боломжтой. JSON-д <code>type: "test"</code>, <code>choices</code> + <code>correct_choice</code> оруулна уу.</p>}
        <p className="small faint" style={{ marginTop: 8, marginBottom: 0 }}>
          <strong>Задгай</strong> — бичиж бодох, зөв хариулт таарвал автоматаар оноо, буруу бол AI бодолтыг үнэлж тайлбарлана. <strong>Тест</strong> — 4 сонголтоос 1 зөв, шууд автоматаар дүгнэнэ.
        </p>
      </div>

      <h2>Асуултууд (урьдчилж харах)</h2>
      {exam.questions.map((q) => (
        <div className="card question-card" key={q.id}>
          <span className="question-points mono">{q.points} оноо</span>
          <span className="question-num mono">№{q.order}</span>
          <div className="q-prompt" style={{ margin: '6px 0' }}><MathText text={q.prompt} /></div>
          <span className="chip-row">
            {q.topic && <span className="badge blue">{q.topic}</span>}
            {(q.tags || []).filter((t) => t !== q.topic).slice(0, 2).map((t) => <span key={t} className="badge">{t}</span>)}
          </span>
        </div>
      ))}
    </>
  );
}
