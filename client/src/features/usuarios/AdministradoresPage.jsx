import UsuarioModal from './UsuarioModal';
import ResetPasswordModal from './ResetPasswordModal';
import UsuarioRow from './UsuarioRow';
import { useUsuariosManagement } from './useUsuariosManagement';

export default function AdministradoresPage() {
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

  // Cuentas de gestión: sin sede asignada (Admin/Supervisor), a diferencia
  // de las cuentas de Tiendas/Oficina/Logística que sí están ligadas a una.
  const administradores = usuarios.filter((u) => !u.tipo_sede);

  const rowProps = {
    onEdit: (u) => setModal({ open: true, usuario: u }),
    onResetPassword: (u) => setResetModal({ open: true, idUsuario: u.id_usuario }),
    onToggleActivo: handleToggleActivo
  };

  return (
    <main className="w-full px-4 sm:px-6 pt-6 space-y-6">
      <div className="antigravity-card p-5 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-brand font-bold text-lg text-gray-900">Administradores y Supervisores</h2>
          <p className="text-xs text-gray-500">Cuentas de gestión, sin sede asignada — ven y administran todas las tiendas.</p>
        </div>
        <button
          onClick={() => setModal({ open: true, usuario: null })}
          className="btn-bissu px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Administrador
        </button>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-center text-xs text-gray-400 py-8">Cargando usuarios...</p>}
        {error && <p className="text-center text-xs text-red-500 py-8">{error.message}</p>}
        {!isLoading && !error && administradores.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">No hay administradores o supervisores registrados.</p>
        )}
        {!isLoading && !error && administradores.map((u) => <UsuarioRow key={u.id_usuario} usuario={u} {...rowProps} />)}
      </div>

      <UsuarioModal open={modal.open} usuario={modal.usuario} saving={saving} defaultRol="SUPERVISOR" onClose={() => setModal({ open: false, usuario: null })} onSubmit={handleSubmit} />
      <ResetPasswordModal open={resetModal.open} saving={savingReset} onClose={() => setResetModal({ open: false, idUsuario: null })} onSubmit={handleResetPassword} />
    </main>
  );
}
