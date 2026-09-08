import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createUsuario, fetchUsuarios, resetPassword, toggleActivo, updateUsuario } from '../../api/usuarios';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import UsuarioModal from './UsuarioModal';
import ResetPasswordModal from './ResetPasswordModal';

const ROL_COLORS = {
  ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
  SUPERVISOR: 'bg-sky-50 text-sky-700 border-sky-200',
  RRHH: 'bg-amber-50 text-amber-700 border-amber-200',
  TIENDA: 'bg-gray-100 text-gray-700 border-gray-200'
};

export default function UsuariosPage() {
  const showToast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState({ open: false, usuario: null });
  const [saving, setSaving] = useState(false);
  const [resetModal, setResetModal] = useState({ open: false, idUsuario: null });
  const [savingReset, setSavingReset] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: ['usuarios'], queryFn: fetchUsuarios });
  const usuarios = data?.usuarios || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['usuarios'] });

  const handleSubmit = async (payload) => {
    setSaving(true);
    try {
      const result = modal.usuario ? await updateUsuario(modal.usuario.id_usuario, payload) : await createUsuario(payload);
      showToast(result.message || 'Usuario guardado exitosamente.', 'success');
      setModal({ open: false, usuario: null });
      invalidate();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (password) => {
    setSavingReset(true);
    try {
      const result = await resetPassword(resetModal.idUsuario, password);
      showToast(result.message, 'success');
      setResetModal({ open: false, idUsuario: null });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingReset(false);
    }
  };

  const handleToggleActivo = async (usuario) => {
    const nuevoActivo = !usuario.activo;
    if (!nuevoActivo) {
      const ok = await confirm('¿Desactivar este usuario? No podrá iniciar sesión hasta que lo reactives.');
      if (!ok) return;
    }
    try {
      const result = await toggleActivo(usuario.id_usuario, nuevoActivo);
      showToast(result.message, 'success');
      invalidate();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <main className="w-full px-4 sm:px-6 pt-6 space-y-6">
      <div className="antigravity-card p-5 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-brand font-bold text-lg text-gray-900">Gestión de Usuarios</h2>
          <p className="text-xs text-gray-500">Crea usuarios por tienda, asigna roles y administra contraseñas.</p>
        </div>
        <button onClick={() => setModal({ open: true, usuario: null })} className="btn-bissu px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Usuario
        </button>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-center text-xs text-gray-400 py-8">Cargando usuarios...</p>}
        {error && <p className="text-center text-xs text-red-500 py-8">{error.message}</p>}
        {!isLoading && !error && usuarios.length === 0 && <p className="text-center text-xs text-gray-400 py-8">No hay usuarios registrados.</p>}
        {usuarios.map((u) => {
          const activo = Boolean(u.activo);
          return (
            <div key={u.id_usuario} className="antigravity-card p-4 bg-white flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-[220px]">
                <div className="w-9 h-9 rounded-full bg-pink-50 text-[#D81B60] flex items-center justify-center font-bold text-sm">
                  {u.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">{u.email}</p>
                  <p className="text-[10px] text-gray-400">{u.nombre_tienda || 'Todas las tiendas'}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${ROL_COLORS[u.rol] || ''}`}>{u.rol}</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {activo ? 'ACTIVO' : 'INACTIVO'}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => setModal({ open: true, usuario: u })} className="px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                  Editar
                </button>
                <button
                  onClick={() => setResetModal({ open: true, idUsuario: u.id_usuario })}
                  className="px-3 py-1.5 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg"
                >
                  Contraseña
                </button>
                <button
                  onClick={() => handleToggleActivo(u)}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border ${
                    activo ? 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                  }`}
                >
                  {activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <UsuarioModal open={modal.open} usuario={modal.usuario} saving={saving} onClose={() => setModal({ open: false, usuario: null })} onSubmit={handleSubmit} />
      <ResetPasswordModal open={resetModal.open} saving={savingReset} onClose={() => setResetModal({ open: false, idUsuario: null })} onSubmit={handleResetPassword} />
    </main>
  );
}
