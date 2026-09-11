import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminCatalog() {
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
      <div className="page-title-row">
        <h1>Сургууль / Хөтөлбөр / Шалгалт</h1>
      </div>
      <UniversityList universities={universities} reload={loadUniversities} />
      <ExamSection
        universities={universities}
        exams={exams}
        programFilter={programFilter}
        setProgramFilter={(v) => { setProgramFilter(v); loadExams(v).catch((e) => toast(e.message)); }}
        reload={() => loadExams(programFilter)}
      />
      <AcademicRegistrationSection />
    </>
  );
}

/* ─────────────── Universities + Programs ─────────────── */
function UniversityList({ universities, reload }) {
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
                    api('/admin/catalog/programs/reorder', { method: 'POST', body: { ids } }).then(reload); }
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? 'Сургууль засах' : 'Шинэ сургууль'}</h3>
        <label>Сургуулийн нэр *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Жишээ: Монголын Их Сургууль" autoFocus />
        <label>Товч нэр (сонголт)</label>
        <input value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} placeholder="МУИС" />
        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.name.trim()} onClick={save}>{busy ? '…' : isEdit ? 'Хадгалах' : 'Нэмэх'}</button>
        </div>
      </div>
    </div>
  );
}

function ProgramModal({ mode, program, universityId, universities, onClose, onSaved }) {
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? 'Хичээл засах' : 'Шинэ хичээл'}</h3>
        {!isEdit && (
          <>
            <label>Сургууль *</label>
            <select value={form.universityId} onChange={(e) => setForm({ ...form, universityId: e.target.value })}>
              {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </>
        )}
        <label>Хичээлийн нэр *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Жишээ: Нэг хувьсагчийн функцийн онол 1Б" autoFocus />
        <label>Хичээлийн код (сонголт)</label>
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATH101" />
        <label>Салбар сургууль (сонголт)</label>
        <input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="МТЭС" />
        <p className="small faint" style={{ margin: '4px 0 0' }}>Хоосон орхивал хичээл нь оюутны нүүр хуудаснад шууд харагдана. Мэргэжлийн нэрс (МТЭС, БС, ХЗС, ШУС, ИТС, УТСОУХНУС) бичвэл бүртгэлийн маягтад л ашиглагдана.</p>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.name.trim()} onClick={save}>{busy ? '…' : isEdit ? 'Хадгалах' : 'Нэмэх'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Exams ─────────────── */
function ExamSection({ universities, exams, programFilter, setProgramFilter, reload }) {
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

/* ─────────────── Бүртгэлийн салбар / хөтөлбөр — тусдаа AcademicProgram ─────────────── */
function AcademicRegistrationSection() {
  const [list, setList] = useState([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [form, setForm] = useState({ university: 'МУИС', school: '', name: '', code: '' });
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const load = () => api('/academic-programs').then((d) => setList(d.programs)).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []);
  const schools = [...new Set(list.map((p) => p.school))].sort();
  const filtered = schoolFilter ? list.filter((p) => p.school === schoolFilter) : list;
  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api(`/admin/academic-programs/${editing}`, { method: 'PUT', body: form });
      else await api('/admin/academic-programs', { method: 'POST', body: form });
      toast(editing ? 'Шинэчлэлээ' : 'Нэмлээ');
      setForm({ university: 'МУИС', school: '', name: '', code: '' }); setEditing(null); load();
    } catch (err) { toast(err.message); }
  };
  return (
    <>
      <div className="page-title-row" style={{ marginTop: 32, borderTop: '2px solid var(--rule)', paddingTop: 16 }}>
        <h2 style={{ margin: 0 }}>Мэргэжлийн жагсаалт</h2>
        <span className="badge">{list.length}</span>
      </div>
      <p className="small muted">Бүртгэлийн <code>Салбар сургууль → Мэргэжил</code> сонголтод хэрэглэнэ — шалгалтын <code>Сургууль / Хөтөлбөр / Шалгалт</code> -аас тусдаа. <code>МТЭС</code> сонговол тухайн салбарын мэргэжлүүд харагдана.</p>
      <div className="filter-bar">
        <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
          <option value="">Бүх салбар</option>
          {schools.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {schoolFilter && <span className="small muted" style={{ alignSelf: 'center' }}>{filtered.length} хөтөлбөр</span>}
      </div>
      <form className="card" onSubmit={submit} style={{ marginTop: 8 }}>
        <div className="field-inline">
          <div><label>Салбар *</label><input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="МТЭС, ШУС, БС, ХЗС, ИТС, УТСОУХНУС" /></div>
          <div style={{ flex: 2 }}><label>Хөтөлбөр / Мэргэжил *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Нягтлан бодох, Программ хангамж, Орон судлал, Багш..." /></div>
          <div><label>Код</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ACC101" /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn small" type="submit">{editing ? 'Хадгалах' : 'Нэмэх'}</button>
            {editing && <button type="button" className="btn secondary small" style={{ marginLeft: 8 }} onClick={() => { setEditing(null); setForm({ university: 'МУИС', school: '', name: '', code: '' }); }}>Цуцлах</button>}
          </div>
        </div>
      </form>
      <div className="card" style={{ marginTop: 12 }}>
        {filtered.length === 0 ? <div className="empty-state">Хөтөлбөр алга.</div> : filtered.map((p) => (
          <div key={p.id} className="row-link" style={{ padding: '8px 4px' }}>
            <span><strong>{p.name}</strong> <span className="faint small">— {p.school} · {p.university} {p.code && `· ${p.code}`} · <span className="badge" style={{ marginLeft: 6 }}>{p._count?.students ?? 0} оюутан</span></span></span>
            <span className="btn-row">
              <button className="btn secondary small" onClick={() => { setEditing(p.id); setForm({ university: p.university, school: p.school, name: p.name, code: p.code || '' }); }}>Засах</button>
              <button className="btn ghost-danger small" onClick={() => confirm(`"${p.name}" устгах уу?`) && api(`/admin/academic-programs/${p.id}`, { method: 'DELETE' }).then(() => { toast('Устгалаа'); load(); }).catch((e) => toast(e.message))}>Устгах</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function ExamModal({ universities, programs, initialProgramId, onClose, onSaved }) {
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Шинэ шалгалт</h3>
        <label>Хөтөлбөр *</label>
        <select value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
          <option value="">— Сонгох —</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.university} · {p.name}</option>)}
        </select>
        <label>Шалгалтын код *</label>
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="math1b-2025-fall-variant1" autoFocus />
        <label>Гарчиг *</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Математик 1Б — Явцын шалгалт (2025)" />
        <div className="field-inline">
          <div>
            <label>Он *</label>
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
          <div>
            <label>Хувилбар</label>
            <input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="Variant 1" />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !form.code.trim() || !form.title.trim() || !form.programId} onClick={save}>{busy ? '…' : 'Нэмэх'}</button>
        </div>
      </div>
    </div>
  );
}
