import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', programId: '', school: '', customProgram: '' });
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api('/programs-public')
      .then((d) => setPrograms(d.programs))
      .catch(() => {});
  }, []);

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => (k === 'school' ? { ...f, school: v, programId: '' } : { ...f, [k]: v }));
  };
  const setProgram = (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, programId: v, customProgram: v === '__custom__' ? f.customProgram : '' }));
  };

  // Зөвхөн баталгаат 40 мэргэжил (МТЭС/БС/ХЗС/ШУС/ИТС/УТСОУХНУС) харуулна — хичээлүүдийг хасна
  const validSchools = ['МТЭС', 'БС', 'ХЗС', 'ШУС', 'ИТС', 'УТСОУХНУС'];
  const majorPrograms = programs.filter((p) => validSchools.includes(p.school));
  const schools = [...new Set(majorPrograms.map((p) => p.school))].sort();
  const schoolPrograms = majorPrograms.filter((p) => p.school === form.school);
  const isCustom = form.programId === '__custom__';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = isCustom
        ? { name: form.name, email: form.email, password: form.password, school: form.school, customProgram: form.customProgram }
        : { name: form.name, email: form.email, password: form.password, programId: form.programId || undefined };
      const data = await api('/auth/register', { method: 'POST', body });
      login(data.token, data.user);
      navigate('/student');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">Work<span>·</span>Ahead</div>
        <p className="muted" style={{ textAlign: 'center' }}>Оюутны бүртгэл</p>
        <form className="card" onSubmit={submit}>
          <label htmlFor="name">Нэр</label>
          <input id="name" required value={form.name} onChange={set('name')} />
          <label htmlFor="email">Имэйл</label>
          <input id="email" type="email" required value={form.email} onChange={set('email')} />
          <label htmlFor="password">Нууц үг</label>
          <input id="password" type="password" required minLength={6} value={form.password} onChange={set('password')} />
          <label htmlFor="school">Салбар сургууль</label>
          <select id="school" required value={form.school} onChange={set('school')}>
            <option value="">— Салбар сургууль сонгох —</option>
            {schools.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label htmlFor="program">Мэргэжил / Хөтөлбөр</label>
          <select id="program" value={form.programId} onChange={setProgram} disabled={!form.school}>
            <option value="">{form.school ? '— Хөтөлбөр сонгох —' : 'Эхлээд салбар сургууль сонгоно уу'}</option>
            {schoolPrograms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="__custom__">— Өөр мэргэжил (биеэр бичих) —</option>
          </select>
          {isCustom && (
            <>
              <label htmlFor="customProgram">Мэргэжлийн нэрээ бичнэ үү *</label>
              <input
                id="customProgram"
                required
                minLength={2}
                maxLength={80}
                value={form.customProgram}
                onChange={set('customProgram')}
                placeholder="Жишээ: Олон улсын харилцаа, Ашигт малтмалын инженер…"
              />
              <p className="small faint" style={{ margin: '4px 0 0' }}>Бичсэн мэргэжил системд нэмэгдэж, салбар сургууль ({form.school}) дотор бүртгэгдэнэ.</p>
            </>
          )}
          {error && <p className="error-text small">{error}</p>}
          <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
            {busy ? 'Бүртгэж байна…' : 'Бүртгүүлэх'}
          </button>
          <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
            Бүртгэлтэй юу? <Link to="/login">Нэвтрэх</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
