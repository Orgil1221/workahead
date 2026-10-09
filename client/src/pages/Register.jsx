import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import OtpInput from '../components/OtpInput.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', programId: '', school: '', customProgram: '' });
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // 2 алхамт бүртгэл: 'form' (мэдээлэл) → 'otp' (имэйл баталгаажуулах)
  const [step, setStep] = useState('form');
  const [pending, setPending] = useState(null); // Бүртгүүлэх товч дарсан үеийн form
  const [otp, setOtp] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 60s cooldown timer for "Дахин илгээх" button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    api('/academic-programs')
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

  // AcademicProgram — шалгалтын Program-аас тусдаа, МУИС салбар/хөтөлбөр
  const schools = [...new Set(programs.map((p) => p.school))].sort();
  const schoolPrograms = programs.filter((p) => p.school === form.school);
  const isCustom = form.programId === '__custom__';

  // Алхам 1: мэдээлэл оруулаад «Бүртгүүлэх» → OTP илгээж баталгаажуулах алхам руу
  const submit = async (e) => {
    e.preventDefault();
    if (isCustom && form.customProgram.trim().length < 2) {
      setError('Мэргэжлийн нэрээ бичнэ үү');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/send-register-otp', { method: 'POST', body: { email: form.email.trim() } });
      setPending({ ...form, email: form.email.trim() });
      setOtp('');
      setStep('otp');
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Алхам 2: имэйлд ирсэн OTP-г оруулаад баталгаажуулах → бүртгэл үүсэж шууд нэвтэрнэ
  const verifyOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setError('6 оронтой кодоо бүрэн оруулна уу');
      return;
    }
    setOtpBusy(true);
    setError(null);
    try {
      const body = pending.programId === '__custom__'
        ? { name: pending.name, email: pending.email, password: pending.password, school: pending.school, customProgram: pending.customProgram, otp: otp.trim() }
        : { name: pending.name, email: pending.email, password: pending.password, programId: pending.programId || undefined, otp: otp.trim() };
      const data = await api('/auth/register', { method: 'POST', body });
      login(data.token, data.user);
      navigate('/student');
    } catch (err) { setError(err.message); } finally { setOtpBusy(false); }
  };

  const resendOtp = async () => {
    if (cooldown > 0 || !pending) return;
    setOtpBusy(true);
    setError(null);
    try {
      await api('/auth/send-register-otp', { method: 'POST', body: { email: pending.email } });
      setCooldown(60);
    } catch (err) { setError(err.message); } finally { setOtpBusy(false); }
  };

  if (step === 'otp' && pending) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">Work<span>·</span>Ahead</div>
          <p className="muted" style={{ textAlign: 'center' }}>Имэйл баталгаажуулах</p>
          <form className="card" onSubmit={verifyOtp}>
            <p className="small muted" style={{ textAlign: 'center' }}>
              <strong>{pending.email}</strong> хаягт 6 оронтой код илгээлээ (10 минут хүчинтэй).
            </p>
            <label>OTP код</label>
            <OtpInput value={otp} onChange={setOtp} disabled={otpBusy} />
            {error && <p className="error-text small">{error}</p>}
            <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={otpBusy}>
              {otpBusy ? 'Шалгаж байна…' : 'Баталгаажуулж нэвтрэх'}
            </button>
            <button type="button" className="btn secondary" style={{ width: '100%', marginTop: 8 }} disabled={otpBusy || cooldown > 0} onClick={resendOtp}>
              {cooldown > 0 ? `Дахин илгээх (${cooldown}s)` : 'Код дахин илгээх'}
            </button>
            <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setStep('form'); setError(null); }}>Мэдээллээ засах</a>
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">Work<span>·</span>Ahead</div>
        <p className="muted" style={{ textAlign: 'center' }}>Оюутны бүртгэл</p>
        <form className="card" onSubmit={submit}>
          <label htmlFor="name">Нэр</label>
          <input id="name" required minLength={2} maxLength={60} value={form.name} onChange={set('name')} placeholder="Овог нэр" />
          <label htmlFor="email">Имэйл</label>
          <input id="email" type="email" required maxLength={120} value={form.email} onChange={set('email')} placeholder="name@example.com" />
          <label htmlFor="password">Нууц үг</label>
          <input id="password" type="password" required minLength={8} maxLength={72} value={form.password} onChange={set('password')} placeholder="Хамгийн багадаа 8 тэмдэгт" />
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
            {busy ? 'Илгээж байна…' : 'Бүртгүүлэх'}
          </button>
          <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
            Бүртгэлтэй юу? <Link to="/login">Нэвтрэх</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
