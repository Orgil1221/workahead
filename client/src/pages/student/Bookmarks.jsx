import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import FlagModal from '../../components/FlagModal.jsx';
import MathText from '../../components/MathText.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [flagging, setFlagging] = useState(null);
  const toast = useToast();

  const load = () => api('/bookmarks').then((d) => setBookmarks(d.bookmarks)).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bookmarks) return <Spinner />;

  const remove = async (qid) => {
    try { await api(`/bookmarks/${qid}`, { method: 'DELETE' }); load(); }
    catch (e) { toast(e.message); }
  };

  return (
    <>
      <div className="page-title-row"><h1>Хадгалсан асуултууд</h1></div>
      {bookmarks.length === 0 ? (
        <div className="card"><div className="empty-state">Хадгалсан асуулт байхгүй. Тест бөглөхдөө bookmark товчоор хадгална уу.</div></div>
      ) : (
        bookmarks.map((b) => {
          const q = b.question;
          const open = openId === q.id;
          return (
            <div className="card question-card" key={q.id}>
              <span className="question-points mono">{q.points} оноо</span>
              <span className="mono small muted">
                №{q.order} · {q.exam?.title}
              </span>
              <div className="q-prompt" style={{ margin: '8px 0' }}><MathText text={q.prompt} /></div>

              {open && <BookmarkSolution qid={q.id} />}

              <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                <button className="btn secondary small" onClick={() => setOpenId(open ? null : q.id)}>
                  {open ? 'Хаах' : 'Шийдэл харах'}
                </button>
                <span className="btn-row">
                  <button className="icon-btn" title="Flag" onClick={() => setFlagging(q)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M5 21V4m0 1h13l-3 4 3 4H5" /></svg>
                  </button>
                  <button className="btn ghost-danger small" onClick={() => remove(q.id)}>Хасах</button>
                </span>
              </div>
            </div>
          );
        })
      )}
      {flagging && <FlagModal question={flagging} onClose={() => setFlagging(null)} />}
    </>
  );
}

function BookmarkSolution({ qid }) {
  const [sol, setSol] = useState(null);
  useEffect(() => {
    // bookmark rows carry only summary fields — fetch full solution from admin-free endpoint
    api(`/exams/solution/${qid}`).then(setSol).catch(() => {});
  }, [qid]);
  if (!sol) return <Spinner />;
  return (
    <>
      {sol.modelSolution && (
        <div className="solution-block">
          <strong className="small">Иж бүрэн шийдэл</strong>
          <div><MathText text={sol.modelSolution} /></div>
        </div>
      )}
      <div className="answer-block"><strong>Хариулт: </strong><MathText text={sol.answer} /></div>
    </>
  );
}
