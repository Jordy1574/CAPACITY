// Rotula la grilla que tiene debajo, por eso es una barra angosta pegada a
// ella y no una tarjeta suelta: con una solicitud pendiente arriba, dos
// tarjetas del mismo peso visual se confunden entre sí.
export default function OfficialBanner({ hayPendiente }) {
  return (
    <div className="antigravity-card bg-emerald-50 border-2 border-emerald-300 px-5 py-3 flex items-center gap-3">
      <span className="text-xl leading-none">✅</span>
      <div>
        <p className="font-brand font-black text-sm text-emerald-800 uppercase tracking-wide">
          Este es el horario oficial
        </p>
        <p className="text-xs text-emerald-700">
          {hayPendiente
            ? 'Vigente hasta que se apruebe la solicitud pendiente. Lo que ves abajo es el oficial, no la propuesta.'
            : 'Ya fue confirmado. Si necesitas cambiar algo, envía una solicitud para que un Admin/Supervisor/RRHH la apruebe.'}
        </p>
      </div>
    </div>
  );
}
