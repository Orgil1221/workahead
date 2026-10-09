import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../../components/Spinner.jsx';
import { enablePush, sendTestPush } from '../../push.js';

export default function AdminNotify() {
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', programId: '' });
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const toast = useToast();

  // Өөрийн утсан дээр push турших (хэрэглэгчдэд илгээхээс өмнө)
  const sendSelfTest = async () => {
    setTestBusy(true);
    try {
      try { await enablePush(); } catch (e) {
        // Аль хэдийн бүртгэлтэй бол үргэлжлүүлнэ, permission denied бол зогсоно
        if (String(e.message).includes('хориглогдсон') || String(e.message).includes('Зөвшөөрөл')) throw e;
      }
      const r = await sendTestPush('WorkAhead тест (админ)', 'Админ push ажиллаж байна.');
      toast(`Тест илгээлээ (${r.sent}/${r.total} төхөөрөмж)`);
    } catch (err) { toast(err.message); }
    finally { setTestBusy(false); }
  };

  const loadPrograms = () => {
    api('/admin/catalog/universities')
      .then((d) => setPrograms(d.universities.flatMap((u) => u.programs.map((p) => ({ ...p, university: u.name })))))
      .catch((e) => toast(e.message));
  };

  const loadList = async () => {
    try {
      setLoading(true);
      const d = await api('/notifications');
      setList(d.notifications || []);
    } catch (e) {
      toast(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
    loadList();
  }, []);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/notifications', { method: 'POST', body: form });
      toast(r.push && r.push.total > 0 ? `Мэдэгдэл + push илгээлээ (${r.push.sent}/${r.push.total})` : 'Мэдэгдэл илгээлээ');
      setForm({ title: '', body: '', programId: '' });
      loadList();
    } catch (err) { toast(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Энэ мэдэгдлийг устгах уу? Оюутнуудын хуудаснаас шууд алга болно.')) return;
    setDeleting(id);
    try {
      await api(`/notifications/${id}`, { method: 'DELETE' });
      setList((prev) => prev.filter((n) => n.id !== id));
      toast('Мэдэгдэл устгалаа');
    } catch (err) {
      toast(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="page-title-row"><h1>Мэдэгдэл илгээх</h1></div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>Push турших (өөртөө)</h3>
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Хэрэглэгчдэд зарлахаасаа өмнө өөрийн утсан дээрээ шалгаарай — утсаа түгжээд ирж байгаа эсэхийг хараарай.
        </p>
        <button className="btn" onClick={sendSelfTest} disabled={testBusy}>
          {testBusy ? 'Илгээж байна…' : 'Өөртөө тест push явуулах'}
        </button>
      </div>
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

      <div className="page-title-row" style={{ marginTop: 28 }}>
        <h2 style={{ margin: 0 }}>Илгээсэн мэдэгдлүүд</h2>
        <span className="badge">{list.length}</span>
      </div>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <div className="card empty-state">Илгээсэн мэдэгдэл алга</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((n) => (
            <div key={n.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.95rem', wordBreak: 'break-word' }}>{n.title}</div>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    {n.program ? n.program.name : 'Бүх оюутан'} · {n.createdBy?.name || 'Админ'} · {new Date(n.createdAt).toLocaleString('mn-MN')}
                  </div>
                </div>
                <button
                  className="btn ghost-danger small"
                  onClick={() => remove(n.id)}
                  disabled={deleting === n.id}
                  title="Устгах"
                  style={{ flexShrink: 0 }}
                >
                  {deleting === n.id ? 'Устгаж…' : 'Устгах'}
                </button>
              </div>
              <div style={{ fontSize: '.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--ink-soft)' }}>
                {n.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
