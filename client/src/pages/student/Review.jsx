import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import MathText from '../../components/MathText.jsx';

export default function Review() {
  const [questions, setQuestions] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [solutions, setSolutions] = useState({});

  useEffect(() => {
    api('/attempts/practice/wrong').then((d) => setQuestions(d.questions)).catch(() => setQuestions([]));
  }, []);

  async function reveal(qid) {
    setOpenId(openId === qid ? null : qid);
    if (!solutions[qid]) {
      try {
        const d = await api(`/exams/solution/${qid}`);
        setSolutions((s) => ({ ...s, [qid]: d }));
      } catch {}
    }
  }

  if (!questions) return <Spinner />;

  return (
    <>
      <div className="page-title-row">
        <h1>Давталт — буруу бодсон асуултууд</h1>
      </div>
      {questions.length === 0 ? (
        <div className="card"><div className="empty-state">
          Буруу бодсон асуулт байхгүй байна. Амжилт хүсье!
        </div></div>
      ) : (
        <>
          <p className="small muted" style={{ marginTop: -6 }}>
            Таны өмнөх тестүүдэд буруу бодсон {questions.length} асуулт. Шийдлийг хараад дахин бодоорой.
          </p>
          {questions.map((q, i) => {
            const open = openId === q.id;
            return (
              <div className="card question-card" key={q.id}>
                <span className="question-points mono">{q.points} оноо</span>
                <span className="question-num mono">№{i + 1}</span>
                {q.topic && <span className="badge blue" style={{ marginLeft: 4 }}>{q.topic}</span>}
                <div className="q-prompt" style={{ margin: '8px 0' }}><MathText text={q.prompt} /></div>
                <span className="faint small mono">{q.exam?.title}</span>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn secondary small" onClick={() => reveal(q.id)}>
                    {open ? 'Хаах' : 'Шийдэл харах'}
                  </button>
                </div>
                {open && solutions[q.id] && (
                  <>
                    {solutions[q.id].modelSolution && (
                      <div className="solution-block">
                        <strong className="small">Иж бүрэн шийдэл</strong>
                        <div><MathText text={solutions[q.id].modelSolution} /></div>
                      </div>
                    )}
                    <div className="answer-block">
                      <strong className="small" style={{ fontFamily: 'var(--font-body)' }}>Хариулт: </strong>
                      <MathText text={solutions[q.id].answer} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
