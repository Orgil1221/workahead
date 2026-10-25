import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import OtpInput from '../components/OtpInput.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendOtp = async () => {
    if (!email.includes('@')) {
      setError('Имэйлээ зөв оруулна уу');
      return;
    }
    if (cooldown > 0) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      setStep(2);
      setCooldown(60);
      setInfo('Хэрэв бүртгэл байгаа бол 6 оронтой код илгээгдлээ. Админ хэрэглэгч бол L.monhorgil2007@gmail.com хаягаа шалгана уу.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('6 оронтой OTP кодоо оруулна уу');
      return;
    }
    if (newPassword.length < 12) {
      setError('Шинэ нууц үг хамгийн багадаа 12 тэмдэгт');
      return;
    }
    if (newPassword !== confirm) {
      setError('Нууц үг баталгаажуулалт таарахгүй байна');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { email: email.trim(), otp: otp.trim(), newPassword },
      });
      setInfo('Нууц үг амжилттай шинэчлэгдлээ — нэвтрэх хуудас руу шилжиж байна…');
      setTimeout(() => navigate('/login'), 1500);
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
        <p className="muted" style={{ textAlign: 'center' }}>Нууц үг сэргээх</p>
        {step === 1 ? (
          <form className="card" onSubmit={(e) => { e.preventDefault(); sendOtp(); }}>
            <p className="small muted" style={{ marginTop: 0 }}>
              Бүртгэлтэй имэйл хаягаа оруулна уу — 6 оронтой сэргээх код илгээнэ.
            </p>
            <label htmlFor="fp-email">Имэйл</label>
            <input
              id="fp-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tanii@example.com"
            />
            {error && <p className="error-text small">{error}</p>}
            {info && <p className="small" style={{ color: 'var(--ok, #2e7d32)' }}>{info}</p>}
            <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy || cooldown > 0}>
              {busy ? 'Илгээж байна…' : cooldown > 0 ? `Дахин илгээх (${cooldown}s)` : 'Код илгээх'}
            </button>
            <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
              <Link to="/login">Нэвтрэх рүү буцах</Link>
            </p>
          </form>
        ) : (
          <form className="card" onSubmit={reset}>
            <p className="small muted" style={{ marginTop: 0 }}>
              <strong>{email}</strong> бүртгэлд зориулсан кодоо оруулж шинэ нууц үгээ үүсгэнэ үү. Админ код зөвхөн L.monhorgil2007@gmail.com хаягт ирнэ.
            </p>
            <label>OTP код</label>
            <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            <label htmlFor="fp-new">Шинэ нууц үг</label>
            <input
              id="fp-new"
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Хамгийн багадаа 12 тэмдэгт"
            />
            <label htmlFor="fp-confirm">Шинэ нууц үг (давтах)</label>
            <input
              id="fp-confirm"
              type="password"
              required
              minLength={12}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && <p className="error-text small">{error}</p>}
            {info && <p className="small" style={{ color: 'var(--ok, #2e7d32)' }}>{info}</p>}
            <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
              {busy ? 'Хадгалж байна…' : 'Нууц үг шинэчлэх'}
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ width: '100%', marginTop: 8 }}
              disabled={busy || cooldown > 0}
              onClick={sendOtp}
            >
              {cooldown > 0 ? `Дахин илгээх (${cooldown}s)` : 'Код дахин илгээх'}
            </button>
            <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setStep(1); }}>Имэйл засах</a>
              {' · '}
              <Link to="/login">Нэвтрэх</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
