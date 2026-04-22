import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';

interface ProtectedRouteProps {
  requiredRole?: UserRole;
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect non-active users
  if (user?.status === 'pending' || user?.status === 'waiting') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (user?.status === 'disabled') {
    return <Navigate to="/login" replace />;
  }

  // Role-based access check
  if (requiredRole) {
    const roleHierarchy: Record<UserRole, number> = {
      viewer: 1,
      staff: 2,
      admin: 3,
    };

    if (roleHierarchy[user!.role] < roleHierarchy[requiredRole]) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
