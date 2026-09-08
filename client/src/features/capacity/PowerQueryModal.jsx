import { useEffect, useState } from 'react';
import { fetchExportUrl } from '../../api/capacity';
import { useToast } from '../../hooks/useToast';

export default function PowerQueryModal({ open, mes, onClose }) {
  const [url, setUrl] = useState('');
  const showToast = useToast();

  useEffect(() => {
    if (!open) return;
    fetchExportUrl(mes)
      .then((data) => setUrl(data.url))
      .catch((err) => showToast(err.message, 'error'));
  }, [open, mes]);

  if (!open) return null;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    showToast('URL copiada al portapapeles', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-xl w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-brand font-bold text-lg text-gray-900">Conexión a Power Query / Power BI</h3>
              <p className="text-xs text-gray-500">Formato desdinamizado (Unpivoted) listo para consumo directo.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Endpoint URL con API Key</label>
          <div className="flex items-center gap-2">
            <input type="text" readOnly value={url} className="w-full bg-gray-50 border border-gray-200 text-xs font-mono p-3 rounded-xl outline-none" />
            <button onClick={copyUrl} className="px-4 py-3 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all whitespace-nowrap">
              Copiar URL
            </button>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
          <p className="text-xs font-bold text-gray-700">Instrucciones en Power BI / Excel:</p>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>
              Abre Power BI o Excel y selecciona <b>Obtener datos -&gt; Web</b>.
            </li>
            <li>Pega la URL copiada arriba.</li>
            <li>
              Haz clic en <b>Aceptar</b>. La estructura vendrá desdinamizada automáticamente sin requerir transformaciones adicionales.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
