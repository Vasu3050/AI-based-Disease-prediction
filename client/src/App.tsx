import { Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { PublicLayout } from './components/layout/PublicLayout';
import { AdminAudit } from './pages/admin/AdminAudit';
import { AdminModels } from './pages/admin/AdminModels';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminSystem } from './pages/admin/AdminSystem';
import { AdminUsers } from './pages/admin/AdminUsers';
import { About } from './pages/public/About';
import { HowItWorks } from './pages/public/HowItWorks';
import { Landing } from './pages/public/Landing';
import { Login } from './pages/public/Login';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { Register } from './pages/public/Register';
import { Safety } from './pages/public/Safety';
import { Compare } from './pages/app/Compare';
import { Dashboard } from './pages/app/Dashboard';
import { HistoryPage } from './pages/app/HistoryPage';
import { NewReport } from './pages/app/NewReport';
import { NotFound } from './pages/app/NotFound';
import { Patients } from './pages/app/Patients';
import { PredictionResults } from './pages/app/PredictionResults';
import { ReportDetail } from './pages/app/ReportDetail';
import { SettingsPage } from './pages/app/SettingsPage';
import { Trends } from './pages/app/Trends';

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="safety" element={<Safety />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>

      {/* Authenticated application */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="reports/new" element={<NewReport />} />
        <Route path="reports/:id" element={<ReportDetail />} />
        <Route path="predictions/:id" element={<PredictionResults />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="trends" element={<Trends />} />
        <Route path="compare" element={<Compare />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Admin (role-guarded) */}
        <Route
          path="admin"
          element={
            <ProtectedRoute admin>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="models" element={<AdminModels />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="system" element={<AdminSystem />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
