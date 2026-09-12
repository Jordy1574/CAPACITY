import { useQuery } from '@tanstack/react-query';
import { fetchHistorialUsuario } from '../../api/usuarios';

const ACCION_LABELS = {
  CREAR: 'Cuenta creada',
  EDITAR_ROL: 'Rol modificado',
  EDITAR_CORREO: 'Correo modificado',
  RESET_PASSWORD: 'Contraseña restablecida',
  ACTIVAR: 'Cuenta activada',
  DESACTIVAR: 'Cuenta desactivada',
  ELIMINAR: 'Cuenta eliminada'
};

const ACCION_COLORS = {
  CREAR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EDITAR_ROL: 'bg-sky-50 text-sky-700 border-sky-200',
  EDITAR_CORREO: 'bg-sky-50 text-sky-700 border-sky-200',
  RESET_PASSWORD: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVAR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DESACTIVAR: 'bg-gray-100 text-gray-600 border-gray-200',
  ELIMINAR: 'bg-red-50 text-red-700 border-red-200'
};

export default function HistorialModal({ open, usuario, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['historial-usuario', usuario?.id_usuario],
    queryFn: () => fetchHistorialUsuario(usuario.id_usuario),
    enabled: open && Boolean(usuario)
  });
  const historial = data?.historial || [];

  if (!open || !usuario) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-lg w-full p-6 space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-brand font-bold text-lg text-gray-900">Historial de la Cuenta</h3>
            <p className="text-xs text-gray-500">{usuario.email || usuario.username}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto space-y-2 flex-1">
          {isLoading && <p className="text-center text-xs text-gray-400 py-8">Cargando historial...</p>}
          {error && <p className="text-center text-xs text-red-500 py-8">{error.message}</p>}
          {!isLoading && !error && historial.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-8">Sin cambios registrados todavía.</p>
          )}
          {historial.map((h) => (
            <div key={h.id_auditoria} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${ACCION_COLORS[h.accion] || ''}`}>
                  {ACCION_LABELS[h.accion] || h.accion}
                </span>
                <span className="text-[10px] text-gray-400">{new Date(h.fecha).toLocaleString('es-PE')}</span>
              </div>
              {h.detalle && <p className="text-xs text-gray-700">{h.detalle}</p>}
              <p className="text-[10px] text-gray-400">Por {h.actor_identificador}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
