import { useEffect, useState } from 'react';
import { useAdminApi, AdminLink as Link } from './AdminContext.jsx';
import { AdminDialog, AdminHeading, AdminIcon } from './AdminUI.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminCatalog() {
  const api = useAdminApi();
  const [universities, setUniversities] = useState(null);
  const [exams, setExams] = useState([]);
  const [programFilter, setProgramFilter] = useState('');
  const toast = useToast();

  const loadUniversities = () => api('/admin/catalog/universities').then((d) => setUniversities(d.universities));
  const loadExams = (pid) => {
    const q = pid ? `?programId=${pid}` : '';
    return api(`/admin/catalog/exams${q}`).then((d) => setExams(d.exams));
  };

  useEffect(() => {
    Promise.all([loadUniversities(), loadExams()]).catch((e) => toast(e.message));
  }, []);

  if (!universities) return <Spinner />;

  return (
    <>
      <AdminHeading eyebrow="СУРГАЛТЫН КОНТЕНТ" title="Хичээл, шалгалт" description="Их сургууль, хичээл, шалгалтын санг шатлалтайгаар удирд." />
      <UniversityList universities={universities} reload={loadUniversities} />
      <ExamSection
        universities={universities}
        exams={exams}
        programFilter={programFilter}
        setProgramFilter={(v) => { setProgramFilter(v); loadExams(v).catch((e) => toast(e.message)); }}
        reload={() => loadExams(programFilter)}
      />
      <div className="ad-catalog-note"><AdminIcon name="graduation" /><p>Оюутны бүртгэлийн салбар, мэргэжлийн жагсаалт нь хичээл, шалгалтаас тусдаа.</p><Link to="/admin/academic-programs" className="ad-text-link">Салбар, мэргэжил<AdminIcon name="arrow" size={16} /></Link></div>
    </>
  );
}

/* ─────────────── Universities + Programs ─────────────── */
function UniversityList({ universities, reload }) {
  const api = useAdminApi();
  const toast = useToast();
  const [uniModal, setUniModal] = useState(null); // {mode:'add'|'edit', uni?}
  const [progModal, setProgModal] = useState(null); // {mode:'add', universityId} | {mode:'edit', program}
  const act = (fn, msg) => fn.then(() => { toast(msg); reload(); }).catch((e) => toast(e.message));

  return (
    <>
      <div className="page-title-row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Сургуулиуд</h2>
        <button className="btn small" onClick={() => setUniModal({ mode: 'add' })}>+ Сургууль</button>
      </div>
      {universities.map((u) => (
        <div className="card" key={u.id}>
          <div className="row-link" style={{ borderBottom: 'none', paddingBottom: 6 }}>
            <strong>{u.name}{u.shortName && <span className="muted"> ({u.shortName})</span>}</strong>
            <span className="btn-row">
              <button className="btn secondary small" onClick={() => setUniModal({ mode: 'edit', uni: u })}>Засах</button>
              <button className="btn ghost-danger small" onClick={() =>
                confirm(`"${u.name}" болон бүх хөтөлбөр/шалгалтыг устгах уу?`) &&
                act(api(`/admin/catalog/universities/${u.id}`, { method: 'DELETE' }), 'Устгалаа')
              }>Устгах</button>
            </span>
          </div>

          {u.programs.map((p) => (
            <div key={p.id} className="row-link">
              <span>
                {p.code && <span className="mono small" style={{ color: 'var(--blue-ink)', marginRight: 8 }}>{p.code}</span>}
                {p.name}
                {p.school && <span className="faint small" style={{ marginLeft: 6 }}>({p.school})</span>}
                <span className="faint mono small"> · {p._count?.exams ?? p.exams?.length ?? 0} шалгалт</span>
              </span>
              <span className="btn-row">
                <button className="icon-btn" title="Дээш" onClick={() => {
                  const ids = u.programs.map((x) => x.id);
                  const i = ids.indexOf(p.id);
                  if (i > 0) { [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                    api('/admin/catalog/programs/reorder', { method: 'POST', body: { ids } }).then(reload).catch((error) => toast(error.message)); }
                }}>↑</button>
                <button className="btn secondary small" onClick={() => setProgModal({ mode: 'edit', program: p })}>Засах</button>
                <button className="btn ghost-danger small" onClick={() =>
                  confirm(`"${p.name}" устгах уу?`) && act(api(`/admin/catalog/programs/${p.id}`, { method: 'DELETE' }), 'Устгалаа')
                }>Устгах</button>
              </span>
            </div>
          ))}

          <button className="btn secondary small" style={{ marginTop: 8 }} onClick={() => setProgModal({ mode: 'add', universityId: u.id })}>+ Хичээл</button>
        </div>
      ))}

      {uniModal && (
        <UniversityModal
          mode={uniModal.mode}
          uni={uniModal.uni}
          onClose={() => setUniModal(null)}
          onSaved={() => { setUniModal(null); reload(); }}
        />
      )}
      {progModal && (
        <ProgramModal
          mode={progModal.mode}
          program={progModal.program}
          universityId={progModal.universityId}
          universities={universities}
          onClose={() => setProgModal(null)}
          onSaved={() => { setProgModal(null); reload(); }}
        />
      )}
    </>
  );
}

function UniversityModal({ mode, uni, onClose, onSaved }) {
  const api = useAdminApi();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({ name: uni?.name || '', shortName: uni?.shortName || '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    if (!form.name.trim()) return toast('Сургуулийн нэр шаардлагатай');
    setBusy(true);
    try {
      if (isEdit) await api(`/admin/catalog/universities/${uni.id}`, { method: 'PUT', body: { name: form.name.trim(), shortName: form.shortName.trim() || null } });
      else await api('/admin/catalog/universities', { method: 'POST', body: { name: form.name.trim(), shortName: form.shortName.trim() || null } });
      toast(isEdit ? 'Хадгаллаа' : 'Сургууль нэмлээ');
      onSaved();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };
  return (
    <AdminDialog title={<>{isEdit ? 'Сургууль засах' : 'Шинэ сургууль'}</>} onClose={onClose} busy={busy}>
        <label htmlFor="admin-catalog-field-1">Сургуулийн нэр *</label>
        <input id="admin-catalog-field-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Жишээ: Монголын Их Сургууль" autoFocus />
        <label htmlFor="admin-catalog-field-2">Товч нэр (сонголт)</label>
        <input id="admin-catalog-field-2" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} placeholder="МУИС" />
        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.name.trim()} onClick={save}>{busy ? '…' : isEdit ? 'Хадгалах' : 'Нэмэх'}</button>
        </div>
    </AdminDialog>
  );
}

function ProgramModal({ mode, program, universityId, universities, onClose, onSaved }) {
  const api = useAdminApi();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    name: program?.name || '',
    code: program?.code || '',
    school: program?.school || '',
    universityId: program?.universityId || universityId || universities[0]?.id || '',
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    if (!form.name.trim()) return toast('Хичээлийн нэр шаардлагатай');
    if (!form.universityId) return toast('Сургууль сонгоно уу');
    setBusy(true);
    try {
      if (isEdit) await api(`/admin/catalog/programs/${program.id}`, { method: 'PUT', body: { name: form.name.trim(), code: form.code.trim() || null, school: form.school.trim() || null } });
      else await api('/admin/catalog/programs', { method: 'POST', body: { name: form.name.trim(), code: form.code.trim() || null, school: form.school.trim() || null, universityId: form.universityId } });
      toast(isEdit ? 'Хадгаллаа' : 'Хичээл нэмлээ');
      onSaved();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };
  return (
    <AdminDialog title={<>{isEdit ? 'Хичээл засах' : 'Шинэ хичээл'}</>} onClose={onClose} busy={busy}>
        {!isEdit && (
          <>
            <label htmlFor="admin-catalog-field-3">Сургууль *</label>
            <select id="admin-catalog-field-3" value={form.universityId} onChange={(e) => setForm({ ...form, universityId: e.target.value })}>
              {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </>
        )}
        <label htmlFor="admin-catalog-field-4">Хичээлийн нэр *</label>
        <input id="admin-catalog-field-4" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Жишээ: Нэг хувьсагчийн функцийн онол 1Б" autoFocus />
        <label htmlFor="admin-catalog-field-5">Хичээлийн код (сонголт)</label>
        <input id="admin-catalog-field-5" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATH101" />
        <label htmlFor="admin-catalog-field-6">Салбар сургууль (сонголт)</label>
        <input id="admin-catalog-field-6" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="МТЭС" />
        <p className="small faint" style={{ margin: '4px 0 0' }}>Хоосон орхивал хичээл нь оюутны нүүр хуудаснад шууд харагдана. Мэргэжлийн нэрс (МТЭС, БС, ХЗС, ШУС, ИТС, УТСОУХНУС) бичвэл бүртгэлийн маягтад л ашиглагдана.</p>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.name.trim()} onClick={save}>{busy ? '…' : isEdit ? 'Хадгалах' : 'Нэмэх'}</button>
        </div>
    </AdminDialog>
  );
}

/* ─────────────── Exams ─────────────── */
function ExamSection({ universities, exams, programFilter, setProgramFilter, reload }) {
  const api = useAdminApi();
  const toast = useToast();
  // Шалгалт хичээлд хамаарна — 41 мэргэжил (МТЭС/БС/...) сонголтод орохгүй
  const MAJOR_SCHOOLS = ['МТЭС', 'БС', 'ХЗС', 'ШУС', 'ИТС', 'УТСОУХНУС'];
  const programs = universities.flatMap((u) =>
    u.programs
      .filter((p) => !MAJOR_SCHOOLS.includes(p.school))
      .map((p) => ({ ...p, university: u.name }))
  );
  const [examModal, setExamModal] = useState(null);

  return (
    <>
      <div className="page-title-row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Шалгалтууд</h2>
        <button className="btn small" onClick={() => setExamModal({ mode: 'add' })}>+ Шалгалт</button>
      </div>
      <div className="filter-bar">
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
          <option value="">Бүх хичээл</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.university !== 'Монголын Их Сургууль' ? `${p.university} · ` : ''}{p.name}</option>
          ))}
        </select>
      </div>
      <div className="card">
        {exams.length === 0 ? (
          <div className="empty-state">Шалгалт байхгүй.</div>
        ) : exams.map((ex) => (
          <div key={ex.id} className="row-link" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <Link to={`/admin/questions?examId=${ex.id}`} className="mono small blue" style={{ color: 'var(--blue-ink)' }}>
                {ex.code}
              </Link>
              {ex.isFree
                ? <span className="badge ok" style={{ marginLeft: 8 }}>Үнэгүй</span>
                : <span className="badge" style={{ marginLeft: 8, background: 'var(--paper)', borderColor: 'var(--rule)' }}>30 хоногийн багцад</span>}
              <span style={{ display: 'block', fontWeight: 500 }}>{ex.title}</span>
              <span className="small muted">
                {ex.year}{ex.variant ? ` · ${ex.variant}` : ''} · {ex._count.questions} асуулт · {ex._count.attempts} оролдлого
              </span>
            </span>
            <span className="btn-row" style={{ flexWrap: 'wrap' }}>
              <button
                className={`btn small ${ex.isFree ? 'secondary' : ''}`}
                style={ex.isFree ? {} : { background: 'var(--ok)', borderColor: 'var(--ok)', color: '#fff' }}
                onClick={() => {
                  const next = !ex.isFree;
                  if (!confirm(`"${ex.title}"-г ${next ? 'ҮНЭГҮЙ' : 'БАГЦАД (төлбөрт)'} болгох уу?`)) return;
                  api(`/admin/catalog/exams/${ex.id}`, { method: 'PUT', body: { isFree: next } })
                    .then(() => { toast(next ? 'Үнэгүй болголоо' : 'Багцад орууллаа'); reload(); })
                    .catch((e) => toast(e.message));
                }}
                title={ex.isFree ? 'Багцад оруулах' : 'Үнэгүй болгох'}
              >
                {ex.isFree ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                    Багцад
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l7 4v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/></svg>
                    Үнэгүй
                  </span>
                )}
              </button>
              <Link className="btn secondary small" to={`/admin/questions?examId=${ex.id}`}>Асуултууд</Link>
              <button className="btn ghost-danger small" onClick={() =>
                confirm(`"${ex.title}" устгах уу?`) &&
                api(`/admin/catalog/exams/${ex.id}`, { method: 'DELETE' }).then(() => { toast('Устгалаа'); reload(); }).catch((e) => toast(e.message))
              }>Устгах</button>
            </span>
          </div>
        ))}
      </div>
      {examModal && (
        <ExamModal
          universities={universities}
          programs={programs}
          initialProgramId={programFilter}
          onClose={() => setExamModal(null)}
          onSaved={() => { setExamModal(null); reload(); }}
        />
      )}
    </>
  );
}

function ExamModal({ universities, programs, initialProgramId, onClose, onSaved }) {
  const api = useAdminApi();
  const [form, setForm] = useState({
    programId: initialProgramId || programs[0]?.id || '',
    code: '',
    title: '',
    year: new Date().getFullYear(),
    variant: 'Variant 1',
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    if (!form.programId) return toast('Хөтөлбөр сонгоно уу');
    if (!form.code.trim()) return toast('Код шаардлагатай');
    if (!form.title.trim()) return toast('Гарчиг шаардлагатай');
    if (!form.year) return toast('Он шаардлагатай');
    setBusy(true);
    try {
      await api('/admin/catalog/exams', { method: 'POST', body: { programId: form.programId, code: form.code.trim(), title: form.title.trim(), year: Number(form.year), variant: form.variant.trim() || null } });
      toast('Шалгалт нэмлээ');
      onSaved();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };
  return (
    <AdminDialog title={<>Шинэ шалгалт</>} onClose={onClose} busy={busy}>
        <label htmlFor="admin-catalog-field-7">Хөтөлбөр *</label>
        <select id="admin-catalog-field-7" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
          <option value="">— Сонгох —</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.university} · {p.name}</option>)}
        </select>
        <label htmlFor="admin-catalog-field-8">Шалгалтын код *</label>
        <input id="admin-catalog-field-8" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="math1b-2025-fall-variant1" autoFocus />
        <label htmlFor="admin-catalog-field-9">Гарчиг *</label>
        <input id="admin-catalog-field-9" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Математик 1Б — Явцын шалгалт (2025)" />
        <div className="field-inline">
          <div>
            <label htmlFor="admin-catalog-field-10">Он *</label>
            <input id="admin-catalog-field-10" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
          <div>
            <label htmlFor="admin-catalog-field-11">Хувилбар</label>
            <input id="admin-catalog-field-11" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="Variant 1" />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.code.trim() || !form.title.trim() || !form.programId} onClick={save}>{busy ? '…' : 'Нэмэх'}</button>
        </div>
    </AdminDialog>
  );
}
