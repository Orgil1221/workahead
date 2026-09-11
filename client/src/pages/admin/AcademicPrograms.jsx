import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AcademicPrograms() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ university: 'МУИС', school: '', name: '', code: '', order: 0 });
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const load = () => api('/admin/academic-programs').then((d) => setList(d.programs)).catch((e) => toast(e.message));

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api(`/admin/academic-programs/${editing}`, { method: 'PUT', body: form });
        toast('Шинэчлэлээ');
      } else {
        await api('/admin/academic-programs', { method: 'POST', body: form });
        toast('Нэмлээ');
      }
      setForm({ university: 'МУИС', school: '', name: '', code: '', order: 0 });
      setEditing(null);
      load();
    } catch (err) { toast(err.message); }
  };

  const del = async (id) => {
    if (!confirm('Устгах уу?')) return;
    try { await api(`/admin/academic-programs/${id}`, { method: 'DELETE' }); toast('Устгалаа'); load(); } catch (e) { toast(e.message); }
  };

  const [seeding, setSeeding] = useState(false);
  const seedMajors = async () => {
    if (!confirm('МУИС-ийн 35 стандарт салбар/хөтөлбөрийг сэргээх уу?\\n(давхцалгүй upsert хийнэ, стандарт жагсаалтад байхгүй хуучин МУИС бүртгэлүүд цэвэрлэгдэнэ)')) return;
    setSeeding(true);
    try {
      const d = await api('/admin/academic-programs/seed', { method: 'POST' });
      toast(`Seed дууслаа — нийт ${d.count} хөтөлбөр${d.removed ? `, ${d.removed} хуучин бүртгэл цэвэрлэгдэв` : ''}`);
      load();
    } catch (e) { toast(e.message); } finally { setSeeding(false); }
  };

  const bySchool = list.reduce((acc, p) => {
    if (!acc[p.school]) acc[p.school] = [];
    acc[p.school].push(p);
    return acc;
  }, {});

  return (
    <>
      <div className="page-title-row">
        <h1>Бүртгэлийн салбар / хөтөлбөр (AcademicProgram)</h1>
        <button className="btn secondary small" disabled={seeding} onClick={seedMajors}>
          {seeding ? 'Seed хийж байна…' : '⤓ Seed — МУИС 35 стандарт хөтөлбөр'}
        </button>
      </div>
      <p className="small muted">Энэ хэсэг шалгалтын <code>Сургууль / Хөтөлбөр / Шалгалт</code> -аас тусдаа — зөвхөн бүртгэлийн <code>Салбар сургууль</code> + <code>Мэргэжил</code> сонголтод хэрэглэнэ. МУИС-ийн салбар (МТЭС, ХУС, ИТС гэх мэт) + хөтөлбөр (Нягтлан бодох, Программ хангамж...)-г энд удирдана.</p>

      <form className="card" onSubmit={submit}>
        <div className="field-inline">
          <div>
            <label>Их сургууль *</label>
            <input value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} placeholder="МУИС" />
          </div>
          <div>
            <label>Салбар сургууль *</label>
            <input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="МТЭС, ХУС, ИТС..." />
          </div>
          <div>
            <label>Хөтөлбөр / Мэргэжил *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Нягтлан бодох, Программ хангамж..." />
          </div>
        </div>
        <div className="field-inline" style={{ marginTop: 8 }}>
          <div>
            <label>Код (optional)</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ACC101" />
          </div>
          <div>
            <label>Дараалал</label>
            <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn small" type="submit">{editing ? 'Хадгалах' : 'Нэмэх'}</button>
            {editing && <button type="button" className="btn secondary small" style={{ marginLeft: 8 }} onClick={() => { setEditing(null); setForm({ university: 'МУИС', school: '', name: '', code: '', order: 0 }); }}>Цуцлах</button>}
          </div>
        </div>
      </form>

      {Object.entries(bySchool).sort().map(([school, items]) => (
        <div key={school} className="card" style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px' }}>{school} <span className="badge">{items.length}</span></h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', border: '1px solid var(--rule)', borderRadius: 6 }}>
                <span><strong>{p.name}</strong> <span className="small muted">— {p.university} {p.code && `· ${p.code}`}</span></span>
                <span className="btn-row">
                  <button className="btn secondary small" onClick={() => { setEditing(p.id); setForm({ university: p.university, school: p.school, name: p.name, code: p.code || '', order: p.order }); }}>Засах</button>
                  <button className="btn ghost-danger small" onClick={() => del(p.id)}>Устгах</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {list.length === 0 && <div className="card empty-state">Хөтөлбөр алга — дээрх формд нэмж, эсвэл <code>npm run seed</code> ажиллуулна уу.</div>}
    </>
  );
}
