import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RoleGuard({ allowedRoles }) {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.rol)) {
    return <Navigate to="/capacity" replace />;
  }
  return <Outlet />;
}
