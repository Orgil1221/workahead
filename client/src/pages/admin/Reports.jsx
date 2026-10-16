import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminApi } from './AdminContext.jsx';
import { AdminDialog, AdminHeading } from './AdminUI.jsx';
import Spinner from '../../components/Spinner.jsx';
import MathText from '../../components/MathText.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminReports() {
  const api = useAdminApi();
  const [status, setStatus] = useState('NEW');
  const [flags, setFlags] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [params] = useSearchParams();
  const toast = useToast();

  const load = (s = status) =>
    api(`/flags/admin?status=${s}`).then((d) => setFlags(d.flags)).catch((e) => toast(e.message));

  useEffect(() => {
    const qid = params.get('question');
    if (qid) api(`/admin/catalog/questions/${qid}`).then((d) => openEditor(d.question)).catch(() => {});
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatusFor = async (flag, newStatus) => {
    try {
      await api(`/flags/admin/${flag.id}`, { method: 'PATCH', body: { status: newStatus } });
      toast(newStatus === 'RESOLVED' ? 'Шийдвэрлэсэн гэж тэмдэглэлээ' : 'Шинэ гэж буцаалаа');
      load();
    } catch (e) { toast(e.message); }
  };

  const openEditor = async (question) => {
    // fetch full exam list for context
    const exams = await api('/admin/catalog/exams').then((d) => d.exams).catch(() => []);
    setEditingQuestion({
      question,
      exams,
      prompt: question.prompt,
      answer: question.answer || '',
      modelSolution: question.modelSolution || '',
      resolveFlags: true,
    });
  };

  return (
    <>
      <AdminHeading eyebrow="КОНТЕНТЫН ХЯНАЛТ" title="Алдааны мэдээлэл" description="Оюутнуудаас ирсэн мэдээллийг шалгаж, асуултыг засаж шийдвэрлэнэ." />

      <div className="filter-bar">
        {[['NEW', 'Шинэ'], ['RESOLVED', 'Шийдвэрлэсэн'], ['ALL', 'Бүгд']].map(([v, label]) => (
          <button key={v} className={`btn small ${status === v ? '' : 'secondary'}`}
            aria-pressed={status === v} onClick={() => { setStatus(v); load(v); }}>{label}</button>
        ))}
      </div>

      {!flags ? <Spinner /> : flags.length === 0 ? (
        <div className="card"><div className="empty-state">Мэдэгдэл байхгүй.</div></div>
      ) : flags.map((f) => (
        <div className="card" key={f.id}>
          <div className="row-link" style={{ borderBottom: 'none', paddingBottom: 4 }}>
            <span className="mono small muted">
              {f.question.exam?.title}{f.question.year ? ` · ${f.question.year}` : ''} · №{f.question.order}
            </span>
            <span className={`badge ${f.status === 'NEW' ? 'accent' : 'ok'}`}>
              {f.status === 'NEW' ? 'ШИНЭ' : 'ШИЙДВЭРЛЭСЭН'}
            </span>
          </div>
          <p style={{ margin: '4px 0' }}><strong>Шалтгаан:</strong> {f.reason}</p>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            Илгээсэн: {f.user?.name} · {new Date(f.createdAt).toLocaleString('mn-MN')}
            {' '}· Нийт flag: <span className="mono">{f.question._count.flags}</span>
          </p>
          <details>
            <summary className="small" style={{ cursor: 'pointer', color: 'var(--blue-ink)' }}>Асуултыг харах</summary>
            <div className="q-prompt small"><MathText text={f.question.prompt} /></div>
          </details>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn secondary small" onClick={() => openEditor(f.question)}>Асуулт засах</button>
            {f.status === 'NEW'
              ? <button className="btn small" onClick={() => setStatusFor(f, 'RESOLVED')}>Шийдвэрлэсэн</button>
              : <button className="btn secondary small" onClick={() => setStatusFor(f, 'NEW')}>Шинэ болгох</button>}
          </div>
        </div>
      ))}

      {editingQuestion && (
        <FlagFixModal data={editingQuestion} onClose={() => setEditingQuestion(null)}
          onSaved={() => { setEditingQuestion(null); load(); }} />
      )}
    </>
  );
}

function FlagFixModal({ data, onClose, onSaved }) {
  const api = useAdminApi();
  const [form, setForm] = useState(data);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const save = async () => {
    setBusy(true);
    try {
      await api(`/admin/catalog/questions/${data.question.id}`, {
        method: 'PUT',
        body: {
          prompt: form.prompt, answer: form.answer, modelSolution: form.modelSolution,
          needsReview: false, resolveFlags: form.resolveFlags,
        },
      });
      toast('Засаж хадгаллаа');
      onSaved();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <AdminDialog title={<>Асуулт засах</>} onClose={onClose} busy={busy}>
        <label htmlFor="admin-reports-field-1">Асуултын текст</label>
        <textarea id="admin-reports-field-1" rows={4} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
        <label htmlFor="admin-reports-field-2">Иж бүрэн шийдэл</label>
        <textarea id="admin-reports-field-2" rows={5} value={form.modelSolution} onChange={(e) => setForm({ ...form, modelSolution: e.target.value })} />
        <label htmlFor="admin-reports-field-3">Хариулт</label>
        <input id="admin-reports-field-3" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={form.resolveFlags}
            onChange={(e) => setForm({ ...form, resolveFlags: e.target.checked })} />
          Энэ асуултын flag-уудыг шийдвэрлэсэн болгох
        </label>
        <div className="btn-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy} onClick={save}>{busy ? '…' : 'Хадгалах'}</button>
        </div>
    </AdminDialog>
  );
}
