import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './auth/ProtectedRoute';
import RoleGuard from './auth/RoleGuard';
import LoginPage from './features/login/LoginPage';

const CapacityPage = lazy(() => import('./features/capacity/CapacityPage'));
const HorariosPage = lazy(() => import('./features/horarios/HorariosPage'));
const UsuariosPage = lazy(() => import('./features/usuarios/UsuariosPage'));

function PageFallback() {
  return <div className="p-6 text-sm text-gray-400">Cargando...</div>;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/capacity" replace />} />
            <Route path="/capacity" element={<CapacityPage />} />
            <Route path="/horarios" element={<HorariosPage />} />
            <Route element={<RoleGuard allowedRoles={['ADMIN']} />}>
              <Route path="/usuarios" element={<UsuariosPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
