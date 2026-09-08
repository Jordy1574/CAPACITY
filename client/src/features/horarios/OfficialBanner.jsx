export default function OfficialBanner() {
  return (
    <div className="antigravity-card bg-emerald-50 border-2 border-emerald-300 p-5 flex items-center gap-4">
      <span className="text-3xl leading-none">✅</span>
      <div>
        <p className="font-brand font-black text-lg text-emerald-800 uppercase tracking-wide">Horario Oficial</p>
        <p className="text-xs text-emerald-700">
          Este horario ya fue confirmado. Si necesitas cambiar algo, edita la celda con normalidad — se enviará como una
          solicitud de cambio para que un Admin/Supervisor/RRHH la apruebe.
        </p>
      </div>
    </div>
  );
}
