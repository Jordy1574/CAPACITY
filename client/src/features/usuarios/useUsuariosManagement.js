import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createUsuario, deleteUsuario, fetchUsuarios, resetPassword, toggleActivo, updateUsuario } from '../../api/usuarios';
import { updateTienda } from '../../api/tiendas';
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
  const [credencialesModal, setCredencialesModal] = useState({ open: false, credenciales: null });
  const [historialModal, setHistorialModal] = useState({ open: false, usuario: null });

  const { data, isLoading, error } = useQuery({ queryKey: ['usuarios'], queryFn: fetchUsuarios });
  const usuarios = data?.usuarios || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    queryClient.invalidateQueries({ queryKey: ['tiendas'] });
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    try {
      const usuarioEditado = modal.usuario;
      const { nueva_password: nuevaPassword, ...datos } = payload;
      let result;

      if (!usuarioEditado) {
        // Crear una tienda crea también su cuenta única (lo resuelve el backend).
        result = await createUsuario(datos);
      } else if (datos.tienda) {
        // Editar la fila de una tienda edita los datos de la tienda, no la cuenta.
        result = await updateTienda(usuarioEditado.id_tienda, datos.tienda);
      } else {
        result = await updateUsuario(usuarioEditado.id_usuario, datos);
      }

      // El cambio de contraseña viaja en el mismo formulario de edición, pero
      // es una operación aparte porque queda registrada como tal en el historial.
      if (usuarioEditado && nuevaPassword) {
        await resetPassword(usuarioEditado.id_usuario, nuevaPassword);
      }

      setModal({ open: false, usuario: null });

      if (!usuarioEditado && result.credenciales) {
        setCredencialesModal({ open: true, credenciales: result.credenciales });
      } else if (nuevaPassword) {
        setCredencialesModal({
          open: true,
          credenciales: {
            username: usuarioEditado.username,
            email: usuarioEditado.email,
            password: nuevaPassword
          }
        });
      } else {
        showToast(result.message || 'Usuario guardado exitosamente.', 'success');
      }
      invalidate();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
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

  const handleDelete = async (usuario) => {
    const ok = await confirm(
      `¿Eliminar definitivamente la cuenta "${usuario.email || usuario.username}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      const result = await deleteUsuario(usuario.id_usuario);
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
    credencialesModal,
    setCredencialesModal,
    historialModal,
    setHistorialModal,
    handleSubmit,
    handleToggleActivo,
    handleDelete
  };
}
