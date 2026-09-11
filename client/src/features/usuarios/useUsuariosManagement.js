import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createUsuario, fetchUsuarios, resetPassword, toggleActivo, updateUsuario } from '../../api/usuarios';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';

// Estado y acciones compartidas entre UsuariosPage (pestañas por área) y
// AdministradoresPage (cuentas de gestión) — ambas leen/escriben la misma
// lista de usuarios, solo cambia qué subconjunto muestran.
export function useUsuariosManagement() {
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

  return {
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
  };
}
