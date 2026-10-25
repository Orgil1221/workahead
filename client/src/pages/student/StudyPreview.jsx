import { useMemo } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import MobileHeader from '../../components/MobileHeader.jsx';
import TabBar from '../../components/TabBar.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { StudyContext } from './StudyContext.jsx';
import { createStudyPreviewApi } from './studyPreviewData.js';
import Program from './Program.jsx';
import University from './University.jsx';
import ExamDetail from './ExamDetail.jsx';
import AttemptRunner from './AttemptRunner.jsx';
import History from './History.jsx';
import Review from './Review.jsx';

const tabs = [
  { to: '/preview/study', label: 'Нүүр', icon: 'home', end: true },
  { to: '/preview/dashboard', label: 'Ахиц', icon: 'chart' },
  { to: '/preview/profile', label: 'Профайл', icon: 'users' },
  { to: '/student/history', label: 'Түүх', icon: 'clock' },
  { to: '/preview/payment', label: 'Төлбөр', icon: 'card' },
];
export default function StudyPreview() {
  const value = useMemo(() => ({ request: createStudyPreviewApi(), base: '/preview/study', preview: true }), []);
  const { pathname } = useLocation();
  const toast = useToast();
  return <StudyContext.Provider value={value}>
    <div className="sl-preview-bar"><span><strong>Шалгалтын шинэ загвар</strong>Жишээ өгөгдөл · бодит дүнд нөлөөлөхгүй</span><Link to="/student">Миний бүртгэлээр харах</Link></div>
    <div className="app-shell">
      <aside className="sidebar"><Link to="/preview/study" className="brand" style={{ color: 'inherit', textDecoration: 'none' }}>Work<span>·</span>Ahead</Link><div className="nav-section">Суралцах орон зай</div>{tabs.map((tab) => <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>{tab.label === 'Ахиц' ? 'Миний ахиц' : tab.label}</NavLink>)}<NavLink className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} to="/preview/study/review">Алдсан бодлогууд</NavLink><div style={{ marginTop: 'auto', padding: 12 }}><ThemeToggle /></div></aside>
      <div className="main-col"><MobileHeader onBellClick={() => toast('Жишээ харагдац — шинэ мэдэгдэл алга')} /><main className="content study-content"><div className="page-enter" key={pathname}><Routes><Route index element={<Navigate to="p/demo-math" replace />} /><Route path="p/:programId" element={<Program />} /><Route path="u/:universityId" element={<University />} /><Route path="exam/:examId" element={<ExamDetail />} /><Route path="attempt/:attemptId" element={<AttemptRunner />} /><Route path="history" element={<History />} /><Route path="review" element={<Review />} /><Route path="dashboard" element={<Navigate to="/preview/dashboard" replace />} /></Routes></div></main></div>
      <TabBar items={tabs} />
    </div>
  </StudyContext.Provider>;
}
