import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminApi } from './AdminContext.jsx';
import { AdminDialog } from './AdminUI.jsx';
import Spinner from '../../components/Spinner.jsx';
import MathText from '../../components/MathText.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const emptyForm = {
  type: 'open', topic: '', level: '', year: '', source: '',
  prompt: '', modelSolution: '', answer: '', points: 1,
  needsReview: false, tags: '', examId: '',
  choiceA: '', choiceB: '', choiceC: '', choiceD: '', correctChoice: 'A',
};

export default function AdminQuestions() {
  const api = useAdminApi();
  const [params] = useSearchParams();
  const [exams, setExams] = useState([]);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    examId: params.get('examId') || '', q: params.get('q') && !params.get('examId') ? '' : '',
    topic: '', level: '', year: '', tag: '', type: '',
    searchId: params.get('q') || '',
  });
  const [editing, setEditing] = useState(null); // null | form object
  const toast = useToast();

  useEffect(() => { api('/admin/catalog/exams').then((d) => setExams(d.exams)).catch(() => {}); }, []);

  const load = useCallback(async (f, page = 1) => {
    const qs = new URLSearchParams();
    if (f.searchId) return api(`/admin/catalog/questions/${f.searchId}`).then((d) =>
      setData({ total: 1, page: 1, pageSize: 1, questions: [d.question] }));
    for (const k of ['examId', 'topic', 'level', 'year', 'tag', 'type']) if (f[k]) qs.set(k, f[k]);
    if (f.q) qs.set('q', f.q);
    qs.set('page', page);
    try { setData(await api(`/admin/catalog/questions?${qs}`)); }
    catch (e) { toast(e.message); }
  }, []);

  useEffect(() => { load(filters); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => load(filters);

  const del = (question) => {
    if (!confirm('Асуултыг устгах уу?')) return;
    api(`/admin/catalog/questions/${question.id}`, { method: 'DELETE' })
      .then(() => { toast('Устгалаа'); load(filters); })
      .catch((e) => toast(e.message));
  };

  return (
    <>
      <div className="page-title-row">
        <div><p className="ad-eyebrow">СУРГАЛТЫН КОНТЕНТ</p><h1>Асуултын сан</h1><p className="ad-page-description">Асуулт, бодолт, зөв хариултын чанарыг хянаж удирд.</p></div>
        <button className="btn small" onClick={() => setEditing({ ...emptyForm })}>+ Асуулт</button>
      </div>

      <div className="filter-bar">
        <select aria-label="Шалгалтаар шүүх" value={filters.examId} onChange={(e) => setFilters({ ...filters, examId: e.target.value })}>
          <option value="">Бүх шалгалт</option>
          {exams.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
        </select>
        <select aria-label="Асуултын төрөл" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Бүх төрөл</option>
          <option value="open">Задгай</option>
          <option value="test">Тест</option>
        </select>
        <input placeholder="Сэдэв…" value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })} />
        <select aria-label="Түвшин" value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value })}>
          <option value="">Түвшин бүгд</option>
          <option value="easy">Хялбар</option>
          <option value="medium">Дунд</option>
          <option value="hard">Хэцүү</option>
        </select>
        <input type="number" placeholder="Жил…" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} />
        <input placeholder="Tag…" value={filters.tag} onChange={(e) => setFilters({ ...filters, tag: e.target.value })} />
        <input placeholder="Эрэл хайлт…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <button className="btn small" onClick={applyFilters}>Шүүх</button>
      </div>

      {!data ? <Spinner /> : (
        <>
          <p className="small muted">Нийт: <span className="mono">{data.total}</span></p>
          <QuestionTable questions={data.questions} onEdit={(q) => setEditing(toForm(q))} onDelete={del} onMove={(q, dir) => {
            // reorder within same exam
            const ids = data.questions.filter((x) => x.examId === q.examId).map((x) => x.id);
            const i = ids.indexOf(q.id), j = i + dir;
            if (j >= 0 && j < ids.length) {
              [ids[i], ids[j]] = [ids[j], ids[i]];
              api('/admin/catalog/questions/reorder', { method: 'POST', body: { ids } })
                .then(() => load(filters)).catch((e) => toast(e.message));
            }
          }} />
          {data.total > data.page * data.pageSize && (
            <button className="btn secondary" style={{ width: '100%' }}
              onClick={() => load(filters, data.page + 1)}>Дараагийн хуудас</button>
          )}
        </>
      )}

      {editing && (
        <QuestionModal
          form={editing}
          exams={exams}
          onClose={() => setEditing(null)}
          onSave={() => { setEditing(null); load(filters); }}
        />
      )}
    </>
  );
}

function toForm(q) {
  const choices = Array.isArray(q.choices) ? q.choices : [];
  const get = (k) => choices.find((c) => c.key === k)?.text || '';
  return {
    id: q.id, examId: q.examId, type: q.type || 'open', topic: q.topic || '', level: q.level || '',
    year: q.year ?? '', source: q.source || '', prompt: q.prompt,
    modelSolution: q.modelSolution || '', answer: q.answer || '',
    points: q.points, needsReview: q.needsReview, tags: (q.tags || []).join(', '),
    choiceA: get('A'), choiceB: get('B'), choiceC: get('C'), choiceD: get('D'),
    correctChoice: q.correctChoice || 'A',
    resolveFlags: false,
  };
}

function QuestionTable({ questions, onEdit, onDelete, onMove }) {
  if (!questions.length) return <div className="card"><div className="empty-state">Асуулт олдсонгүй.</div></div>;
  return (
    <>
      {questions.map((q, i) => (
        <div className="card question-card" key={q.id}>
          <span className="question-points mono">{q.points} оноо · #{q.order}</span>
          <span className="question-num mono">№{i + 1}</span>
          <span className={`badge ${q.type === 'test' ? 'blue' : ''}`} style={{ marginLeft: 6 }}>{q.type === 'test' ? 'Тест' : 'Задгай'}</span>
          <span className="mono small muted" style={{ marginLeft: 6 }}>{q.exam?.title}{q.year ? ` (${q.year})` : ''}</span>
          {q._count.flags > 0 && <span className="badge accent" style={{ marginLeft: 6 }}>{q._count.flags} flag</span>}
          {q.needsReview && <span className="badge warn" style={{ marginLeft: 6 }}>хянана</span>}
          <div className="q-prompt" style={{ margin: '8px 0' }}><MathText text={q.prompt} /></div>
          {(q.type === 'test' || (Array.isArray(q.choices) && q.choices.length===4)) && Array.isArray(q.choices) && (
            <div className="small" style={{ marginBottom: 6, display: 'grid', gap: 4 }}>
              {q.choices.map((c) => (
                <span key={c.key} className={`badge ${q.correctChoice === c.key ? 'blue' : ''}`} style={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', color: 'var(--ink)', opacity: 1, background: q.correctChoice === c.key ? 'color-mix(in srgb, var(--blue-ink) 10%, transparent)' : 'var(--paper)', borderColor: 'var(--rule)' }}>
                  <span className="mono" style={{ marginRight: 6, color: q.correctChoice === c.key ? 'var(--blue-ink)' : 'var(--ink-faint)' }}>{c.key}.</span><span style={{ color: 'var(--ink)' }}><MathText text={c.text} /></span>
                  {q.correctChoice === c.key && <span className="mono" style={{ marginLeft: 6, color: 'var(--ok)' }}>✓</span>}
                </span>
              ))}
            </div>
          )}
          <div className="chip-row">
            {q.topic && <span className="badge blue">{q.topic}</span>}
            {q.level && <span className="badge">{q.level}</span>}
            {(q.tags || []).slice(0, 4).map((t) => <span key={t} className="badge">{t}</span>)}
          </div>
          <hr className="divider-dashed" />
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <span className="btn-row">
              <button className="icon-btn" title="Дээш" onClick={() => onMove(q, -1)}>↑</button>
              <button className="icon-btn" title="Доош" onClick={() => onMove(q, +1)}>↓</button>
            </span>
            <span className="btn-row">
              <button className="btn secondary small" onClick={() => onEdit(q)}>Засах</button>
              <button className="btn ghost-danger small" onClick={() => onDelete(q)}>Устгах</button>
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

function QuestionModal({ form: initial, exams, onClose, onSave }) {
  const api = useAdminApi();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...form };
      if (body.level === '') body.level = null;
      if (form.id) await api(`/admin/catalog/questions/${form.id}`, { method: 'PUT', body });
      else await api('/admin/catalog/questions', { method: 'POST', body });
      toast('Хадгаллаа');
      onSave();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <AdminDialog title={<>{form.id ? 'Асуулт засах' : 'Шинэ асуулт'}</>} onClose={onClose} busy={busy}>

        {!form.id && (
          <>
            <label htmlFor="admin-questions-field-1">Шалгалт *</label>
            <select id="admin-questions-field-1" value={form.examId} onChange={set('examId')}>
              <option value="">— Сонгох —</option>
              {exams.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </>
        )}

        <label>Асуултын төрөл *</label>
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button type="button" className={`btn small ${form.type === 'open' ? '' : 'secondary'}`} onClick={() => setForm((f) => ({ ...f, type: 'open' }))}>Задгай</button>
          <button type="button" className={`btn small ${form.type === 'test' ? '' : 'secondary'}`} onClick={() => setForm((f) => ({ ...f, type: 'test' }))}>Тест (4 сонголт)</button>
        </div>

        <label htmlFor="admin-questions-field-2">Асуултын текст *</label>
        <textarea id="admin-questions-field-2" rows={3} value={form.prompt} onChange={set('prompt')} />
        {form.prompt && (
          <div className="card small" style={{ padding: '10px 14px', marginTop: -6 }}>
            <span className="faint mono" style={{ fontSize: '.68rem' }}>УРЬДЧИЛЖ ХАРАХ</span>
            <div className="q-prompt" style={{ margin: '4px 0 0' }}><MathText text={form.prompt} /></div>
          </div>
        )}

        <div className="field-inline">
          <div>
            <label htmlFor="admin-questions-field-3">Оноо</label>
            <input id="admin-questions-field-3" type="number" min="0" step="0.5" value={form.points} onChange={set('points')} />
          </div>
          <div>
            <label htmlFor="admin-questions-field-4">Сэдэв</label>
            <input id="admin-questions-field-4" value={form.topic} onChange={set('topic')} />
          </div>
        </div>
        <div className="field-inline">
          <div>
            <label htmlFor="admin-questions-field-5">Түвшин</label>
            <select id="admin-questions-field-5" value={form.level} onChange={set('level')}>
              <option value="">—</option><option value="easy">Хялбар</option>
              <option value="medium">Дунд</option><option value="hard">Хэцүү</option>
            </select>
          </div>
          <div>
            <label htmlFor="admin-questions-field-6">Жил</label>
            <input id="admin-questions-field-6" type="number" value={form.year} onChange={set('year')} />
          </div>
        </div>
        <label htmlFor="admin-questions-field-7">Эх сурвалж</label>
        <input id="admin-questions-field-7" value={form.source} onChange={set('source')} />
        <label htmlFor="admin-questions-field-8">Tag-ууд (таслалаар)</label>
        <input id="admin-questions-field-8" value={form.tags} onChange={set('tags')} />

        {form.type === 'test' ? (
          <>
            <label>Сонголтууд — 1 зөв, 3 буруу *</label>
            <div style={{ display: 'grid', gap: 8 }}>
              {['A', 'B', 'C', 'D'].map((k) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 48, margin: 0 }}>
                    <input type="radio" name="correctChoice" checked={form.correctChoice === k} onChange={() => setForm((f) => ({ ...f, correctChoice: k }))} style={{ width: 'auto' }} />
                    <span className={`badge ${form.correctChoice === k ? 'blue' : ''} mono`}>{k}</span>
                  </label>
                  <input style={{ flex: 1 }} placeholder={`${k} сонголт…`} value={form[`choice${k}`] || ''} onChange={set(`choice${k}`)} />
                </div>
              ))}
            </div>
            <p className="small faint" style={{ marginTop: 6 }}>Зөв хариултын радио товчийг сонгоно. Тест горимд шууд автоматаар дүгнэнэ.</p>
            <label htmlFor="admin-questions-field-9">Зөв хариултын утга (answer) — тайлбарт хэрэглэнэ</label>
            <input id="admin-questions-field-9" value={form.answer} onChange={set('answer')} placeholder="Жишээ: x=5" />
          </>
        ) : (
          <>
            <label htmlFor="admin-questions-field-10">Иж бүрэн шийдэл</label>
            <textarea id="admin-questions-field-10" rows={4} value={form.modelSolution} onChange={set('modelSolution')} />
            <label htmlFor="admin-questions-field-11">Эцсийн хариулт (Задгай — яг таарвал автоматаар оноо)</label>
            <input id="admin-questions-field-11" value={form.answer} onChange={set('answer')} />
          </>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={!!form.needsReview}
            onChange={(e) => setForm((f) => ({ ...f, needsReview: e.target.checked }))} />
          Хяналт шаардлагатай (needs_review)
        </label>

        {form.id && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!form.resolveFlags}
              onChange={(e) => setForm((f) => ({ ...f, resolveFlags: e.target.checked }))} />
            Хадгалсны дараа энэ асуултын flag-уудыг "шийдвэрлэсэн" болгох
          </label>
        )}

        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.prompt || (!form.id && !form.examId) || (form.type === 'test' && (!form.choiceA?.trim() || !form.choiceB?.trim() || !form.choiceC?.trim() || !form.choiceD?.trim()))} onClick={save}>
            {busy ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
    </AdminDialog>
  );
}
