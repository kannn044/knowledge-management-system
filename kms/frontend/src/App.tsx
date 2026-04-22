import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/shared/ProtectedRoute';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage';
import PendingApprovalPage from '@/pages/auth/PendingApprovalPage';
import OAuthCallbackPage from '@/pages/auth/OAuthCallbackPage';

// App pages (Phase 2+ will add real content)
import DashboardPage from '@/pages/dashboard/DashboardPage';
import DocumentsPage from '@/pages/documents/DocumentsPage';
import SearchPage from '@/pages/dashboard/SearchPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminAuditPage from '@/pages/admin/AdminAuditPage';
import NotFoundPage from '@/pages/NotFoundPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
        <Route path="/pending-approval" element={<PendingApprovalPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* Protected — all authenticated users */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
        </Route>

        {/* Protected — admin only */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/audit" element={<AdminAuditPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
