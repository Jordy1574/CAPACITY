import { useState } from 'react';

function CopyField({ label, value }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Portapapeles no disponible; el admin puede seleccionar el texto manualmente.
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={value}
          className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 outline-none"
        />
        <button
          type="button"
          onClick={copiar}
          className="px-3 py-2.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl whitespace-nowrap"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

export default function CredencialesModal({ open, credenciales, onClose }) {
  if (!open || !credenciales) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-sm w-full p-6 space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h3 className="font-brand font-bold text-lg text-gray-900">Usuario Creado</h3>
          <p className="text-xs text-gray-500">Guarda o copia estas credenciales — la contraseña no se puede volver a ver después de cerrar esta ventana.</p>
        </div>

        <div className="space-y-3">
          <CopyField label={credenciales.username ? 'Usuario' : 'Correo'} value={credenciales.username || credenciales.email} />
          <CopyField label="Contraseña" value={credenciales.password} />
        </div>

        <div className="flex items-center justify-end pt-3">
          <button type="button" onClick={onClose} className="btn-bissu px-5 py-2 text-xs font-bold uppercase tracking-wider">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
