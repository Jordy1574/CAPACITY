import { useQuery } from '@tanstack/react-query';
import { fetchSolicitudes } from '../../api/horarios';

const ESTADO_COLORS = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  APROBADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RECHAZADA: 'bg-red-50 text-red-700 border-red-200'
};

export default function SolicitudesModal({ open, onClose, onRevisar }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['solicitudes'],
    queryFn: () => fetchSolicitudes(),
    enabled: open
  });

  if (!open) return null;

  const solicitudes = data?.solicitudes || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-2xl w-full p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-brand font-bold text-lg text-gray-900">Solicitudes de Cambio de Horario</h3>
              <p className="text-xs text-gray-500">Revisa la grilla propuesta por cada tienda antes de aprobar o rechazar.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {isLoading && <p className="text-center text-xs text-gray-400 py-8">Cargando solicitudes...</p>}
          {error && <p className="text-center text-xs text-red-500 py-8">{error.message}</p>}
          {!isLoading && !error && solicitudes.length === 0 && <p className="text-center text-xs text-gray-400 py-8">No hay solicitudes registradas.</p>}
          {solicitudes.map((s) => (
            <div key={s.id_solicitud} className="p-4 border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {s.nombre_tienda} ({s.codigo_almacen}) — semana del {s.semana_inicio ? String(s.semana_inicio).split('T')[0] : ''}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Solicitado por {s.solicitado_por_email || '—'} el {new Date(s.fecha_solicitud).toLocaleString('es-PE')}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${ESTADO_COLORS[s.estado] || ''}`}>{s.estado}</span>
              </div>
              <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg">{s.motivo}</p>
              {s.estado === 'PENDIENTE' ? (
                <div className="flex items-center justify-end pt-1">
                  <button
                    onClick={() => onRevisar(s)}
                    className="px-4 py-1.5 text-[11px] font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg"
                  >
                    Revisar en la grilla
                  </button>
                </div>
              ) : (
                s.comentario_resolucion && <p className="text-[10px] text-gray-400 italic">Comentario: {s.comentario_resolucion}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
