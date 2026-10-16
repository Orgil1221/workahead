import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { warmup } from './api/client.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Landing from './pages/Landing.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import StudentLayout from './components/StudentLayout.jsx';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminCatalog from './pages/admin/Catalog.jsx';
import AdminAcademicPrograms from './pages/admin/AcademicPrograms.jsx';
import AdminQuestions from './pages/admin/Questions.jsx';
import AdminImport from './pages/admin/Import.jsx';
import AdminReports from './pages/admin/Reports.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminNotify from './pages/admin/Notify.jsx';
import AdminSettings from './pages/admin/Settings.jsx';

// Student pages
import StudentHome from './pages/student/Home.jsx';
import UniversityPage from './pages/student/University.jsx';
import ProgramPage from './pages/student/Program.jsx';
import ExamDetail from './pages/student/ExamDetail.jsx';
import AttemptRunner from './pages/student/AttemptRunner.jsx';
import Review from './pages/student/Review.jsx';
import Profile from './pages/student/Profile.jsx';
import StudentDashboard from './pages/student/Dashboard.jsx';
import Bookmarks from './pages/student/Bookmarks.jsx';
import History from './pages/student/History.jsx';
import Notifications from './pages/student/Notifications.jsx';
import Payment from './pages/student/Payment.jsx';
import Terms from './pages/Terms.jsx';

const DashboardPreview = import.meta.env.DEV ? lazy(() => import('./pages/student/DashboardPreview.jsx')) : null;
const ProfilePreview = import.meta.env.DEV ? lazy(() => import('./pages/student/ProfilePreview.jsx')) : null;
const PaymentPreview = import.meta.env.DEV ? lazy(() => import('./pages/student/PaymentPreview.jsx')) : null;
const StudyPreview = import.meta.env.DEV ? lazy(() => import('./pages/student/StudyPreview.jsx')) : null;
const AdminPreview = import.meta.env.DEV ? lazy(() => import('./pages/admin/AdminPreview.jsx')) : null;

function Guard({ children, admin }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/student" replace />;
  if (!admin && user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return children;
}

function WarmupBanner() {
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let showTimer = null;
    let dotsTimer = null;

    // Only show banner if health takes > 850ms (cold start)
    showTimer = setTimeout(() => {
      if (!cancelled) setVisible(true);
    }, 850);

    (async () => {
      // warmup() already retries 4x with 10s timeout internally
      for (let i = 0; i < 4; i++) {
        if (cancelled) return;
        setAttempt(i);
        try {
          const ok = await warmup();
          if (ok) break;
        } catch {}
        // warmup() handles its own retries, so single call is enough
        break;
      }
      if (!cancelled) {
        clearTimeout(showTimer);
        setVisible(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(showTimer);
      clearTimeout(dotsTimer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '10px 14px',
        fontSize: '.85rem',
        fontWeight: 600,
        background: 'rgba(39,66,124,.92)',
        color: '#fffdf7',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,.15)',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          border: '2px solid rgba(255,253,247,.35)',
          borderTopColor: '#fffdf7',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin .7s linear infinite',
          flexShrink: 0,
        }}
      />
      Сервер асч байна{'.'.repeat((attempt % 3) + 1)} — Render free cold start ~20-50с, түр хүлээнэ үү
      <span style={{ opacity: .85, fontWeight: 500, fontSize: '.78rem' }}>(refresh хийх шаардлагагүй)</span>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ textAlign: 'center', padding: '18px 16px 40px', fontSize: '.82rem', color: 'var(--ink-faint)', borderTop: '1px solid var(--rule)', marginTop: 24 }}>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <a href="/terms" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Үйлчилгээний нөхцөл</a>
        <a href="tel:+97666336691" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>+976 66336691</a>
        <a href="https://www.facebook.com/profile.php?id=100068091317280" target="_blank" rel="noopener noreferrer" style={{ color: '#1877F2', textDecoration: 'none' }}>Facebook</a>
      </div>
      <div>© 2026 WorkAhead • SSL хамгаалалттай • Bonum Payment Gateway</div>
    </footer>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const isLocalPreview = import.meta.env.DEV && (['/preview/landing', '/preview/dashboard', '/preview/profile', '/preview/payment'].includes(pathname) || ['/preview/study', '/preview/admin'].some((base) => pathname === base || pathname.startsWith(base + '/')));
  return (
    <>
      {!isLocalPreview && <WarmupBanner />}
      <Routes>
        {AdminPreview && <Route path="/preview/admin/*" element={<Suspense fallback={<p role="status">Ачаалж байна…</p>}><AdminPreview /></Suspense>} />}
        {import.meta.env.DEV && <Route path="/preview/landing" element={<Landing preview />} />}
        {StudyPreview && <Route path="/preview/study/*" element={<Suspense fallback={<p role="status">Ачаалж байна…</p>}><StudyPreview /></Suspense>} />}
        {DashboardPreview && <Route path="/preview/dashboard" element={<Suspense fallback={<p role="status">Ачаалж байна…</p>}><DashboardPreview /></Suspense>} />}
        {ProfilePreview && <Route path="/preview/profile" element={<Suspense fallback={<p role="status">Ачаалж байна…</p>}><ProfilePreview /></Suspense>} />}
        {PaymentPreview && <Route path="/preview/payment" element={<Suspense fallback={<p role="status">Ачаалж байна…</p>}><PaymentPreview /></Suspense>} />}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/terms" element={<><Terms /><Footer /></>} />

        <Route path="/admin" element={<Guard admin><AdminLayout /></Guard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="academic-programs" element={<AdminAcademicPrograms />} />
          <Route path="questions" element={<AdminQuestions />} />
          <Route path="import" element={<AdminImport />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="notify" element={<AdminNotify />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="/student" element={<Guard><StudentLayout /></Guard>}>
          <Route index element={<StudentHome />} />
          <Route path="u/:universityId" element={<UniversityPage />} />
          <Route path="p/:programId" element={<ProgramPage />} />
          <Route path="exam/:examId" element={<ExamDetail />} />
          <Route path="attempt/:attemptId" element={<AttemptRunner />} />
          <Route path="review" element={<Review />} />
          <Route path="profile" element={<Profile />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="history" element={<History />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="payment" element={<Payment />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
