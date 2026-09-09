export default function PendingBanner({ solicitud, onRevisar, canRevisar, hayOficial }) {
  if (!solicitud) return null;

  const fecha = new Date(solicitud.fecha_solicitud).toLocaleString('es-PE');

  return (
    <div className="antigravity-card bg-amber-50 border-2 border-amber-300 p-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">⏳</span>
        <div>
          <p className="font-brand font-black text-lg text-amber-800 uppercase tracking-wide">Pendiente de aprobación</p>
          <p className="text-xs text-amber-700">
            Enviado el {fecha} {solicitud.solicitado_por_email ? `por ${solicitud.solicitado_por_email}` : ''}
            {solicitud.motivo ? ` — Motivo: ${solicitud.motivo}` : ''}
          </p>
          {hayOficial && (
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
              El horario oficial que se ve abajo sigue vigente y no cambiará hasta que esta solicitud sea aprobada.
            </p>
          )}
        </div>
      </div>
      {canRevisar && (
        <button
          onClick={onRevisar}
          className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm"
        >
          Revisar Solicitud
        </button>
      )}
    </div>
  );
}
