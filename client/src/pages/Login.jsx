import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaDestination, setMfaDestination] = useState('');
  const [error, setError] = useState(() => {
    try {
      if (localStorage.getItem('wa_kicked') === '1') {
        localStorage.removeItem('wa_kicked');
        return 'Өөр төхөөрөмжөөс нэвтэрсэн тул энэ төхөөрөмжөөс гарлаа. 1 account — 1 desktop + 1 mobile л зэрэг ашиглах боломжтой.';
      }
    } catch {}
    return null;
  });
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = mfaPending
        ? await api('/auth/verify-admin-login', { method: 'POST', body: { email, otp: adminOtp } })
        : await api('/auth/login', { method: 'POST', body: { email, password } });
      if (data.mfaRequired) {
        setMfaPending(true);
        setMfaDestination(data.email || '');
        setError(null);
        return;
      }
      login(data.user);
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/student');
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
        <p className="muted" style={{ textAlign: 'center' }}>Шалгалтын бэлтгэлийн платформ</p>
        <form className="card" onSubmit={submit}>
          {!mfaPending ? <>
            <label htmlFor="email">Имэйл</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="password">Нууц үг</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </> : <>
            <p className="small">Кодыг <strong>{mfaDestination}</strong> хаяг руу илгээлээ. Код 10 минут хүчинтэй. Баталгаажуулсны дараа энэ браузер дээр 24 цаг дахин код шаардахгүй.</p>
            <label htmlFor="admin-otp">Имэйлээр ирсэн 6 оронтой код</label>
            <input id="admin-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={adminOtp} onChange={(e) => setAdminOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <button type="button" className="btn secondary" disabled={busy} onClick={() => { setMfaPending(false); setMfaDestination(''); setAdminOtp(''); setError(null); }}>Буцах / хугацаа дууссан код шинэчлэх</button>
          </>}
          {!mfaPending && <p className="small" style={{ textAlign: 'right', margin: '6px 0 0' }}>
            <Link to="/forgot-password">Нууц үгээ мартсан уу?</Link>
          </p>}
          {error && <p className="error-text small">{error}</p>}
          <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
            {busy ? 'Шалгаж байна…' : mfaPending ? 'Кодоор баталгаажуулах' : 'Нэвтрэх'}
          </button>
          {!mfaPending && <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
            Бүртгэл байхгүй юу? <Link to="/register">Бүртгүүлэх</Link>
          </p>}
        </form>
      </div>
    </div>
  );
}
