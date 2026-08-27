import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminNotify() {
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', programId: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api('/admin/catalog/universities')
      .then((d) => setPrograms(d.universities.flatMap((u) => u.programs.map((p) => ({ ...p, university: u.name })))))
      .catch((e) => toast(e.message));
  }, []);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/notifications', { method: 'POST', body: form });
      toast('Мэдэгдэл илгээлээ');
      setForm({ title: '', body: '', programId: '' });
    } catch (err) { toast(err.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-title-row"><h1>Мэдэгдэл илгээх</h1></div>
      <form className="card" onSubmit={send}>
        <label htmlFor="nprog">Хүлээн авагч</label>
        <select id="nprog" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
          <option value="">Бүх оюутан</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.university} · {p.name}-ийн оюутнууд</option>
          ))}
        </select>
        <label htmlFor="ntitle">Гарчиг *</label>
        <input id="ntitle" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Жишээ: Шинэ шалгалтын материал нэмэгдлээ" />
        <label htmlFor="nbody">Агуулга *</label>
        <textarea id="nbody" required rows={4} value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Мэдэгдлийн дэлгэрэнгүй агуулга…" />
        <button className="btn" style={{ marginTop: 14 }} disabled={busy}>
          {busy ? 'Илгээж байна…' : 'Илгээх'}
        </button>
      </form>
      <p className="small muted">
        Мэдэгдэл нь сонгосон хөтөлбөрийг (эсвэл бүгдийг) хадгалсан оюутнуудын in-app мэдэгдлийн хуудсанд харагдана.
      </p>
    </>
  );
}
