import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      login(data.token, data.user);
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
          <label htmlFor="email">Имэйл</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="password">Нууц үг</label>
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="error-text small">{error}</p>}
          <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
            {busy ? 'Нэвтэрч байна…' : 'Нэвтрэх'}
          </button>
          <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
            Бүртгэл байхгүй юу? <Link to="/register">Бүртгүүлэх</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
