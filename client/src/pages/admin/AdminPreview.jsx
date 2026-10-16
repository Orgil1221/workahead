import { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout.jsx';
import { AdminContext } from './AdminContext.jsx';
import AdminDashboard from './Dashboard.jsx';
import AdminCatalog from './Catalog.jsx';
import AdminAcademicPrograms from './AcademicPrograms.jsx';
import AdminQuestions from './Questions.jsx';
import AdminImport from './Import.jsx';
import AdminReports from './Reports.jsx';
import AdminUsers from './Users.jsx';
import AdminNotify from './Notify.jsx';
import AdminSettings from './Settings.jsx';
import { createAdminPreviewApi } from './adminPreviewData.js';

export default function AdminPreview() {
  const [scenario, setScenario] = useState('populated');
  const context = useMemo(() => ({
    request: createAdminPreviewApi(scenario),
    base: '/preview/admin',
    preview: true,
    user: { id: 'preview-admin', name: 'Админ', role: 'ADMIN' },
  }), [scenario]);
  return <AdminContext.Provider value={context}>
    <div className="ad-preview-banner"><div><strong>АДМИН · LOCAL PREVIEW</strong><span>Жишээ өгөгдөл. Theme, багцыг энд туршиж болно; бусад хадгалах үйлдэл хаалттай. Бодит мэдээлэл өөрчлөхгүй.</span></div><div className="ad-preview-actions"><select aria-label="Preview өгөгдөл" value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="populated">Жишээ өгөгдөл</option><option value="empty">Хоосон төлөв</option><option value="error">Dashboard алдаа</option></select></div></div>
    <Routes key={scenario}>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="catalog" element={<AdminCatalog />} />
        <Route path="academic-programs" element={<AdminAcademicPrograms />} />
        <Route path="questions" element={<AdminQuestions />} />
        <Route path="import" element={<AdminImport />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="notify" element={<AdminNotify />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="/preview/admin" replace />} />
      </Route>
    </Routes>
  </AdminContext.Provider>;
}
