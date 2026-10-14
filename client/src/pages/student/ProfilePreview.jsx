import { useState } from 'react';
import { Link } from 'react-router-dom';
import MobileHeader from '../../components/MobileHeader.jsx';
import TabBar from '../../components/TabBar.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import ProfileView from './ProfileView.jsx';

const previewPrograms = [
  { id: 'preview-software', name: 'Программ хангамж', school: 'Мэдээллийн технологи, электроникийн сургууль' },
  { id: 'preview-computer', name: 'Компьютерын ухаан', school: 'Мэдээллийн технологи, электроникийн сургууль' },
  { id: 'preview-math', name: 'Хэрэглээний математик', school: 'Шинжлэх ухааны сургууль' },
];
const previewUser = { name: 'Тэмүүлэн', email: 'temuulen@example.com', phone: '9900 0000', academicProgram: previewPrograms[0] };
const previewTabs = [
  { to: '/', label: 'Нүүр', icon: 'home', end: true },
  { to: '/preview/dashboard', label: 'Ахиц', icon: 'chart' },
  { to: '/preview/profile', label: 'Профайл', icon: 'users' },
  { to: '/student/history', label: 'Түүх', icon: 'clock' },
  { to: '/preview/payment', label: 'Төлбөр', icon: 'card' },
];

async function loadPreviewPrograms() {
  return previewPrograms;
}

export default function ProfilePreview() {
  const [scenario, setScenario] = useState('active');
  const [user, setUser] = useState(previewUser);
  const [expiresAt] = useState(() => new Date(Date.now() + 18 * 86400000).toISOString());
  const toast = useToast();
  const plans = scenario === 'loading' || scenario === 'error' ? null : scenario === 'empty' ? [] : [{
    id: 'preview-plan', title: 'Шалгалтын бэлтгэлийн багц', priceMnt: 19900,
    durationDays: 30, examCount: 0, owned: scenario === 'active', expiresAt: scenario === 'active' ? expiresAt : null,
  }];

  function changeScenario(event) {
    setScenario(event.target.value);
    setUser(event.target.value === 'new' ? { ...previewUser, name: 'Шинэ суралцагч', phone: '', academicProgram: null } : previewUser);
  }

  async function savePreview(body) {
    const academicProgram = body.customProgram
      ? { id: 'preview-custom', school: body.school, name: body.customProgram }
      : previewPrograms.find((program) => program.id === body.programId) || (user.academicProgram?.id === body.programId ? user.academicProgram : null);
    setUser((current) => ({ ...current, name: body.name, phone: body.phone, academicProgram }));
    toast('Жишээ мэдээлэл шинэчлэгдлээ — бодит бүртгэл өөрчлөгдөөгүй');
  }

  return <>
    <div className="pf-preview-bar"><div><strong>Профайлын урьдчилсан харагдац</strong><span>Жишээ өгөгдөл · хадгалалт зөвхөн энэ харагдацад</span></div><div><label htmlFor="pf-preview-scenario">Төлөв</label><select id="pf-preview-scenario" value={scenario} onChange={changeScenario}><option value="active">Идэвхтэй багц</option><option value="new">Шинэ суралцагч</option><option value="empty">Багцгүй</option><option value="loading">Ачаалж байгаа</option><option value="error">Ачааллын алдаа</option></select><Link to="/student/profile">Миний бүртгэл</Link></div></div>
    <div className="app-shell">
      <aside className="sidebar"><Link className="brand" to="/" style={{ color: 'inherit', textDecoration: 'none' }}>Work<span>·</span>Ahead</Link><div className="nav-section">Суралцах орон зай</div><Link className="nav-item" to="/">Нүүр</Link><Link className="nav-item" to="/preview/dashboard">Миний ахиц</Link><Link className="nav-item active" to="/preview/profile" aria-current="page">Профайл</Link><Link className="nav-item" to="/student/payment">Төлбөр</Link><p className="pf-preview-note">Бага багаар.<br />Өдөр бүр урагш.</p><ThemeToggle /></aside>
      <div className="main-col"><MobileHeader onBellClick={() => toast('Урьдчилсан харагдац — мэдэгдэл ирээгүй')} /><main className="content profile-content"><div className="page-enter"><ProfileView key={scenario} user={user} plans={plans} plansError={scenario === 'error'} onRetryPlans={() => setScenario('active')} loadPrograms={loadPreviewPrograms} onSaveProfile={savePreview} onChangePassword={async () => toast('Жишээ үйлдэл — бодит нууц үг өөрчлөгдөөгүй')} onLogout={() => toast('Урьдчилсан харагдац — бодит бүртгэлээс гарахгүй')} paymentPath="/preview/payment" /></div></main></div>
      <TabBar items={previewTabs} />
    </div>
  </>;
}
