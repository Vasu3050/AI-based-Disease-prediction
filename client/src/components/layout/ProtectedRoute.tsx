import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../ui/Spinner';

export function ProtectedRoute({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner label="Checking session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/app" replace />;
  return <>{children}</>;
}
