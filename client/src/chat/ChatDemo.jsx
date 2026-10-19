import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, ChatIcon } from './ChatUI.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const accounts = [
  { email: 'temuulen@local.workahead', name: 'Тэмүүлэн', role: 'STUDENT', detail: 'Багцтай · #1 badge · Урилга илгээх' },
  { email: 'nomin@local.workahead', name: 'Номин', role: 'STUDENT', detail: 'Багцгүй · Урилга хүлээн авах' },
  { email: 'expired@local.workahead', name: 'Саруул', role: 'STUDENT', detail: 'Багц дууссан · Өмнөх хувийн чат үргэлжилнэ' },
  { email: 'admin@local.workahead', name: 'WorkAhead', role: 'ADMIN', detail: 'Админ · Нийтийн чат · Мэдээлэл хянах' },
];

export default function ChatDemo() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    api('/health').then((result) => { if (result.localChatDemo) setReady(true); else setError('Local chat сервер асаагүй байна. docs/CHAT.md заавраар асаана уу.'); }).catch((failure) => setError(failure.message));
  }, []);
  async function enter(account) {
    setBusy(true); setError('');
    try {
      const health = await api('/health');
      if (!health.localChatDemo) throw new Error('Зөвхөн тусгаарласан local demo сервертэй ажиллана.');
      const result = await api('/auth/login', { method: 'POST', body: { email: account.email, password: 'ChatLocal2026!' } });
      login(result.token, result.user);
      navigate(result.user.role === 'ADMIN' ? '/admin/chat' : '/student');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <main className="chat-page" style={{ maxWidth: 640, margin: '48px auto', padding: 20 }}><div className="ch-page-heading"><div><p className="ch-eyebrow">WORKAHEAD COMMUNITY</p><p className="ch-subtle">LOCAL DEMO · ЖИШЭЭ ӨГӨГДӨЛ</p></div><ThemeToggle compact /></div><p className="ch-subtle">Жишээ бүртгэлээр жинхэнэ чат, typing, урилга, badge-аа туршаарай. Энд бичсэн зүйл зөвхөн энэ компьютерийн тусдаа өгөгдөлд хадгалагдана.</p>{accounts.map((account) => <button key={account.email} className="ch-person-row ch-person-button" disabled={!ready || busy} onClick={() => enter(account)}><Avatar person={account} /><div><strong>{account.name}</strong><small>{account.detail}</small></div><ChatIcon name="chat" /></button>)}{error && <p className="ch-error" role="alert">{error}</p>}<p className="ch-subtle">Хоёр хүнээр зэрэг туршихдаа энэ холбоосыг өөр browser эсвэл Incognito цонхонд нээгээрэй. Ижил browser-ийн tab-ууд нэг бүртгэл ашиглана.</p></main>;
}
