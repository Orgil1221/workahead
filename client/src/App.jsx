import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import RootRedirect from './pages/RootRedirect.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import StudentLayout from './components/StudentLayout.jsx';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminCatalog from './pages/admin/Catalog.jsx';
import AdminQuestions from './pages/admin/Questions.jsx';
import AdminImport from './pages/admin/Import.jsx';
import AdminReports from './pages/admin/Reports.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminNotify from './pages/admin/Notify.jsx';

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

function Guard({ children, admin }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/student" replace />;
  if (!admin && user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/admin" element={<Guard admin><AdminLayout /></Guard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="catalog" element={<AdminCatalog />} />
        <Route path="questions" element={<AdminQuestions />} />
        <Route path="import" element={<AdminImport />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="notify" element={<AdminNotify />} />
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
