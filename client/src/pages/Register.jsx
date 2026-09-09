import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', programId: '', school: '', customProgram: '' });
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [needVerify, setNeedVerify] = useState(null); // {email, token}
  const [otp, setOtp] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 60s cooldown timer for "Code ilgeeh" button (burtguuleh uyd)
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

  const sendRegisterOtp = async () => {
    if (!form.email || !form.email.includes('@')) {
      setError('Эхлээд имэйлээ зөв оруулна уу');
      return;
    }
    if (cooldown > 0) return;
    setOtpBusy(true);
    setError(null);
    try {
      await api('/auth/send-register-otp', { method: 'POST', body: { email: form.email } });
      setCooldown(60);
      setError(null);
    } catch (err) { setError(err.message); } finally { setOtpBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('OTP код оруулна уу — Code илгээх дарж мэйлээ баталгаажуулна уу');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = isCustom
        ? { name: form.name, email: form.email, password: form.password, school: form.school, customProgram: form.customProgram, otp: otp.trim() }
        : { name: form.name, email: form.email, password: form.password, programId: form.programId || undefined, otp: otp.trim() };
      const data = await api('/auth/register', { method: 'POST', body });
      login(data.token, data.user);
      navigate('/student');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setOtpBusy(true);
    setError(null);
    try {
      const data = await api('/auth/verify-otp', { method: 'POST', body: { email: needVerify.email, otp } });
      login(data.token, data.user);
      navigate('/student');
    } catch (err) { setError(err.message); } finally { setOtpBusy(false); }
  };

  const resendOtp = async () => {
    if (cooldown > 0) return;
    setOtpBusy(true);
    setError(null);
    try {
      await api('/auth/send-otp', { method: 'POST', body: { email: needVerify.email } });
      setError(null);
      setCooldown(60);
      alert('OTP дахин илгээлээ — мэйлээ шалгана уу (10 минут хүчинтэй)');
    } catch (err) { setError(err.message); } finally { setOtpBusy(false); }
  };

  if (needVerify) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">Work<span>·</span>Ahead</div>
          <p className="muted" style={{ textAlign: 'center' }}>Мэйл баталгаажуулалт — OTP</p>
          <form className="card" onSubmit={verifyOtp}>
            <p className="small muted" style={{ textAlign: 'center' }}>
              <strong>{needVerify.email}</strong> хаягт 6 оронтой код илгээлээ (10 минут хүчинтэй).<br />Business mail (Resend) тохируулгагүй бол код server log-д харагдана.
            </p>
            <label htmlFor="otp">OTP код</label>
            <input id="otp" required minLength={6} maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" className="mono" style={{ letterSpacing: 4, textAlign: 'center', fontSize: '1.2rem' }} />
            {error && <p className="error-text small">{error}</p>}
            <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={otpBusy}>
              {otpBusy ? 'Шалгаж байна…' : 'Баталгаажуулах'}
            </button>
            <button type="button" className="btn secondary" style={{ width: '100%', marginTop: 8 }} disabled={otpBusy || cooldown > 0} onClick={resendOtp}>
              {cooldown > 0 ? `Дахин илгээх (${cooldown}s)` : 'Code илгээх'}
            </button>
            <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setNeedVerify(null); }}>Буцах</a>
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
          <input id="name" required value={form.name} onChange={set('name')} />
          <label htmlFor="email">Имэйл</label>
          <input id="email" type="email" required value={form.email} onChange={set('email')} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="otp" style={{ marginTop: 0 }}>OTP код *</label>
              <input id="otp" required minLength={6} maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" className="mono" style={{ letterSpacing: 3, textAlign: 'center' }} />
            </div>
            <button type="button" className="btn secondary small" style={{ height: 38, whiteSpace: 'nowrap', marginBottom: 1 }} disabled={otpBusy || cooldown > 0 || !form.email.includes('@')} onClick={sendRegisterOtp}>
              {cooldown > 0 ? `${cooldown}s` : 'Code илгээх'}
            </button>
          </div>
          <p className="small faint" style={{ margin: '4px 0 0' }}>Имэйлээ оруулаад <strong>Code илгээх</strong> дарна — 6 оронтой код 10 минут хүчинтэй, 1 мин тутамд 1 удаа илгээнэ.</p>
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
