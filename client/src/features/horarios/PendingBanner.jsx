export default function PendingBanner({ solicitud, onRevisar, onNuevaSolicitud, canRevisar, hayOficial, esVista }) {
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
      <div className="flex items-center gap-2 flex-wrap">
        {/* Empezar de cero descarta la propuesta actual y parte otra vez del
            horario oficial, en vez de seguir corrigiendo la que ya se envió. */}
        {esVista && onNuevaSolicitud && (
          <button
            onClick={onNuevaSolicitud}
            className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-800 bg-white hover:bg-amber-100 border-2 border-amber-300 rounded-xl"
            title="Descarta esta solicitud y arma una nueva partiendo del horario oficial"
          >
            Empezar de Cero
          </button>
        )}
        {canRevisar && (
          <button
            onClick={onRevisar}
            className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm"
          >
            {esVista ? 'Ver / Corregir Mi Solicitud' : 'Revisar Solicitud'}
          </button>
        )}
      </div>
    </div>
  );
}
