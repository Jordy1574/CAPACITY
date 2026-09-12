import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditoriaCompleta } from '../../api/usuarios';

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

export default function AuditoriaPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['auditoria-completa'], queryFn: fetchAuditoriaCompleta });
  const auditoria = data?.auditoria || [];
  const [soloEliminados, setSoloEliminados] = useState(false);

  const filtrado = soloEliminados ? auditoria.filter((a) => a.accion === 'ELIMINAR') : auditoria;

  return (
    <main className="w-full px-4 sm:px-6 pt-6 space-y-6">
      <div className="antigravity-card p-5 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-brand font-bold text-lg text-gray-900">Historial de Cuentas</h2>
          <p className="text-xs text-gray-500">Registro completo de creaciones, ediciones, activaciones y eliminaciones hechas por Admin/Supervisor.</p>
        </div>
        <button
          onClick={() => setSoloEliminados((v) => !v)}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-colors ${
            soloEliminados ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }`}
        >
          {soloEliminados ? 'Viendo solo eliminadas' : 'Ver solo eliminadas'}
        </button>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-center text-xs text-gray-400 py-8">Cargando historial...</p>}
        {error && <p className="text-center text-xs text-red-500 py-8">{error.message}</p>}
        {!isLoading && !error && filtrado.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">Sin registros todavía.</p>
        )}
        {!isLoading && !error && filtrado.map((h) => (
          <div key={h.id_auditoria} className="antigravity-card p-4 bg-white flex items-center gap-3 flex-wrap">
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${ACCION_COLORS[h.accion] || ''}`}>
              {ACCION_LABELS[h.accion] || h.accion}
            </span>
            <div className="min-w-[160px]">
              <p className="text-xs font-bold text-gray-900">{h.identificador_afectado}</p>
              {h.detalle && <p className="text-[10px] text-gray-500">{h.detalle}</p>}
            </div>
            <div className="ml-auto text-right">
              <p className="text-[11px] text-gray-600">Por {h.actor_identificador}</p>
              <p className="text-[10px] text-gray-400">{new Date(h.fecha).toLocaleString('es-PE')}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
