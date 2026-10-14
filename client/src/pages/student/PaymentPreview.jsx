import { useState } from 'react';
import { Link } from 'react-router-dom';
import MobileHeader from '../../components/MobileHeader.jsx';
import TabBar from '../../components/TabBar.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import PaymentView from './PaymentView.jsx';
import './Profile.css';

const previewPlans = [
  { id: 'preview-full', title: 'Шалгалтын бэлтгэлийн багц', description: 'Шалгалтадаа өөртөө итгэлтэй ороорой. Бодит асуулт, дэлгэрэнгүй бодолт, AI үнэлгээтэйгээр өдөр бүр бага багаар ахиарай.', priceMnt: 19900, durationDays: 30, examCount: 0 },
  { id: 'preview-week', title: '7 хоногийн бэлтгэл', description: 'Ойрын шалгалтдаа төвлөрч бэлдэх богино хугацааны багц.', priceMnt: 7900, durationDays: 7, examCount: 12 },
];
const previewTabs = [
  { to: '/', label: 'Нүүр', icon: 'home', end: true },
  { to: '/preview/dashboard', label: 'Ахиц', icon: 'chart' },
  { to: '/preview/profile', label: 'Профайл', icon: 'users' },
  { to: '/student/history', label: 'Түүх', icon: 'clock' },
  { to: '/preview/payment', label: 'Төлбөр', icon: 'card' },
];

export default function PaymentPreview() {
  const [scenario, setScenario] = useState('available');
  const [verification, setVerification] = useState(null);
  const [now] = useState(() => Date.now());
  const toast = useToast();
  const plans = scenario === 'loading' || scenario === 'error' ? null : scenario === 'empty' ? [] : previewPlans.map((plan, index) => ({ ...plan, owned: scenario === 'active' && index === 0, expiresAt: scenario === 'active' && index === 0 ? new Date(now + 18 * 86400000).toISOString() : null }));
  const transactions = scenario === 'loading' || scenario === 'error' ? null : scenario === 'empty' ? [] : [
    { id: 'preview-txn-1', transactionId: 'preview-pending', plan: { title: '7 хоногийн бэлтгэл' }, amount: 7900, status: 'PENDING', createdAt: new Date(now - 600000).toISOString() },
    { id: 'preview-txn-2', plan: { title: 'Шалгалтын бэлтгэлийн багц' }, amount: 19900, status: 'PAID', createdAt: new Date(now - 12 * 86400000).toISOString(), expiresAt: new Date(now + 18 * 86400000).toISOString() },
    { id: 'preview-txn-3', plan: { title: 'Шалгалтын бэлтгэлийн багц' }, amount: 19900, status: 'FAILED', createdAt: new Date(now - 13 * 86400000).toISOString() },
  ];

  async function previewCheckout() {
    if (scenario === 'checkout-error') throw new Error('Жишээ алдаа: төлбөрийн үйлчилгээ түр боломжгүй байна.');
    toast('Жишээ харагдац — бодит төлбөр, нэхэмжлэл үүсгээгүй');
  }

  const checkPreview = () => setVerification({ type: 'pending', message: 'Жишээ гүйлгээ: баталгаажуулалт хүлээгдэж буй төлөв. Бодит төлбөр үүсээгүй.' });

  return <>
    <div className="pf-preview-bar"><div><strong>Төлбөрийн урьдчилсан харагдац</strong><span>Жишээ үнэ, өгөгдөл · бодит төлбөр үүсэхгүй</span></div><div><label htmlFor="py-preview-scenario">Төлөв</label><select id="py-preview-scenario" value={scenario} onChange={(event) => { setScenario(event.target.value); setVerification(null); }}><option value="available">Багц сонгох</option><option value="active">Идэвхтэй эрх</option><option value="empty">Багц, гүйлгээгүй</option><option value="loading">Ачаалж байгаа</option><option value="error">Ачааллын алдаа</option><option value="checkout-error">Төлбөрийн алдаа</option></select><Link to="/student/payment">Миний бүртгэл</Link></div></div>
    <div className="app-shell">
      <aside className="sidebar"><Link className="brand" to="/" style={{ color: 'inherit', textDecoration: 'none' }}>Work<span>·</span>Ahead</Link><div className="nav-section">Суралцах орон зай</div><Link className="nav-item" to="/">Нүүр</Link><Link className="nav-item" to="/preview/dashboard">Миний ахиц</Link><Link className="nav-item" to="/preview/profile">Профайл</Link><Link className="nav-item active" to="/preview/payment" aria-current="page">Төлбөр</Link><p className="pf-preview-note">Бага багаар.<br />Өдөр бүр урагш.</p><ThemeToggle /></aside>
      <div className="main-col"><MobileHeader onBellClick={() => toast('Урьдчилсан харагдац — мэдэгдэл ирээгүй')} /><main className="content payment-content"><div className="page-enter"><PaymentView key={scenario} plans={plans} plansError={scenario === 'error'} transactions={transactions} historyError={scenario === 'error'} onRetryPlans={() => setScenario('available')} onRetryHistory={() => setScenario('available')} verification={verification} onRetryVerification={checkPreview} onCheckTransaction={checkPreview} onCheckout={previewCheckout} checkoutNotice="Жишээ харагдац: энэ товч бодит төлбөр эсвэл нэхэмжлэл үүсгэхгүй." /></div></main></div>
      <TabBar items={previewTabs} />
    </div>
  </>;
}
