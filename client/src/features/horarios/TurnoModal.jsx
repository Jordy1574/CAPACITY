import { useEffect, useState } from 'react';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { validateBloques } from './turnoValidation';
import { DIA_DESCANSO_A_INDICE, labelDiaDescanso } from './coverage';

const DEFAULT_BLOCK = { hora_inicio: '09:00', hora_fin: '18:00' };

export default function TurnoModal({ open, empNombre, fecha, initialBlocks, diaDescansoEmpleado, onClose, onSubmit }) {
  const [blocks, setBlocks] = useState([]);
  const confirm = useConfirm();
  const showToast = useToast();

  useEffect(() => {
    if (!open) return;
    setBlocks(initialBlocks && initialBlocks.length > 0 ? initialBlocks.map((b) => ({ ...b })) : [{ ...DEFAULT_BLOCK }]);
  }, [open, initialBlocks]);

  if (!open) return null;

  const subtitle = (() => {
    const dateObj = new Date(`${fecha}T00:00:00`);
    const fechaFmt = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${empNombre} — ${fechaFmt}`;
  })();

  const addBlock = () => {
    const last = blocks[blocks.length - 1];
    const nuevaHora = last ? last.hora_fin : '09:00';
    setBlocks((prev) => [...prev, { hora_inicio: nuevaHora, hora_fin: nuevaHora }]);
  };

  const removeBlock = (index) => setBlocks((prev) => prev.filter((_, i) => i !== index));

  const updateBlock = (index, field, value) => setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const filled = blocks.filter((b) => b.hora_inicio && b.hora_fin);
    let sorted;
    try {
      sorted = validateBloques(filled);
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }

    if (sorted.length > 0 && diaDescansoEmpleado) {
      const diaSemana = new Date(`${fecha}T00:00:00`).getDay();
      if (DIA_DESCANSO_A_INDICE[diaDescansoEmpleado] === diaSemana) {
        const continuar = await confirm(
          `${empNombre} tiene ${labelDiaDescanso(diaDescansoEmpleado)} marcado como su día de descanso. ¿Registrar un turno de todas formas?`
        );
        if (!continuar) return;
      }
    }

    onSubmit(sorted);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-md w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-pink-50 text-[#D81B60] rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-brand font-bold text-lg text-gray-900">Editar Turno</h3>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {blocks.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Día marcado como descanso.</p>}
            {blocks.map((block, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="time"
                  value={block.hora_inicio}
                  onChange={(e) => updateBlock(index, 'hora_inicio', e.target.value)}
                  className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
                />
                <span className="text-gray-400 text-xs">a</span>
                <input
                  type="time"
                  value={block.hora_fin}
                  onChange={(e) => updateBlock(index, 'hora_fin', e.target.value)}
                  className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
                />
                <button type="button" onClick={() => removeBlock(index)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Quitar bloque">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="pt-1">
            <button type="button" onClick={addBlock} className="text-xs font-bold text-[#D81B60] hover:underline flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Agregar Bloque
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
              Cancelar
            </button>
            <button type="submit" className="btn-bissu px-5 py-2 text-xs font-bold uppercase tracking-wider">
              Guardar Turno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
