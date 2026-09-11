import { useState } from 'react';
import UsuarioModal from './UsuarioModal';
import ResetPasswordModal from './ResetPasswordModal';
import UsuarioRow from './UsuarioRow';
import { useUsuariosManagement } from './useUsuariosManagement';

// Pestañas por área (tipo de sede) — independiente del rol del usuario.
const AREAS = [
  { key: 'TIENDA', label: 'Tiendas', icon: '🏬' },
  { key: 'OFICINA', label: 'Oficina', icon: '🏢' },
  { key: 'LOGISTICA', label: 'Logística', icon: '📦' }
];

export default function UsuariosPage() {
  const {
    usuarios,
    isLoading,
    error,
    modal,
    setModal,
    saving,
    resetModal,
    setResetModal,
    savingReset,
    handleSubmit,
    handleResetPassword,
    handleToggleActivo
  } = useUsuariosManagement();
  const [areaActiva, setAreaActiva] = useState('TIENDA');

  const grupos = { TIENDA: [], OFICINA: [], LOGISTICA: [] };
  usuarios.forEach((u) => {
    if (grupos[u.tipo_sede]) grupos[u.tipo_sede].push(u);
  });
  const usuariosDelArea = grupos[areaActiva] || [];

  const rowProps = {
    onEdit: (u) => setModal({ open: true, usuario: u }),
    onResetPassword: (u) => setResetModal({ open: true, idUsuario: u.id_usuario }),
    onToggleActivo: handleToggleActivo
  };

  return (
    <main className="w-full px-4 sm:px-6 pt-6 space-y-6">
      <div className="antigravity-card p-5 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-brand font-bold text-lg text-gray-900">Usuarios por Sede</h2>
          <p className="text-xs text-gray-500">Cuentas de Tiendas, Oficina y Logística — asigna la sede y administra contraseñas.</p>
        </div>
        <button onClick={() => setModal({ open: true, usuario: null })} className="btn-bissu px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Usuario
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        {AREAS.map((a) => {
          const activa = areaActiva === a.key;
          return (
            <button
              key={a.key}
              onClick={() => setAreaActiva(a.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activa ? 'border-[#D81B60] text-[#D81B60]' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>{a.icon}</span> {a.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activa ? 'bg-pink-50 text-[#D81B60]' : 'bg-gray-100 text-gray-400'}`}>
                {grupos[a.key].length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-center text-xs text-gray-400 py-8">Cargando usuarios...</p>}
        {error && <p className="text-center text-xs text-red-500 py-8">{error.message}</p>}
        {!isLoading && !error && usuariosDelArea.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">No hay usuarios en esta área todavía.</p>
        )}
        {!isLoading && !error && usuariosDelArea.map((u) => <UsuarioRow key={u.id_usuario} usuario={u} {...rowProps} />)}
      </div>

      <UsuarioModal open={modal.open} usuario={modal.usuario} saving={saving} onClose={() => setModal({ open: false, usuario: null })} onSubmit={handleSubmit} />
      <ResetPasswordModal open={resetModal.open} saving={savingReset} onClose={() => setResetModal({ open: false, idUsuario: null })} onSubmit={handleResetPassword} />
    </main>
  );
}
