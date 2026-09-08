export default function SaveBar({ count, saving, onDiscard, onSave, saveLabel = 'Guardar Cambios', savingLabel = 'Guardando...' }) {
  const visible = count > 0;
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 antigravity-card bg-gray-900/95 text-white px-6 py-3.5 rounded-2xl flex items-center gap-6 shadow-2xl transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-[#D81B60] animate-ping"></span>
        <span className="text-xs font-bold">
          {count} cambio{count !== 1 ? 's' : ''} pendiente{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onDiscard} className="px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-all">
          Descartar
        </button>
        <button onClick={onSave} disabled={saving} className="btn-bissu px-5 py-2 text-xs uppercase font-bold tracking-wider flex items-center gap-2">
          <span>{saving ? savingLabel : saveLabel}</span>
          {!saving && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
