import { useEffect, useState } from 'react';
import { crearNovedad, eliminarNovedad, fetchNovedades } from '../../api/horarios';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';

const TIPOS = [
  { value: 'VACACIONES', label: 'Vacaciones' },
  { value: 'DESCANSO_MEDICO', label: 'Descanso médico' },
  { value: 'FALTA', label: 'Falta' },
  { value: 'PERMISO', label: 'Permiso' },
  { value: 'LICENCIA', label: 'Licencia' }
];

const inputClass = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]';
const labelClass = 'block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1';

function diasEntre(inicio, fin) {
  if (!inicio || !fin) return 0;
  const ms = new Date(`${fin}T00:00:00`) - new Date(`${inicio}T00:00:00`);
  return Math.floor(ms / 86400000) + 1;
}

export default function NovedadesModal({ open, empleado, onClose, onSaved }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [novedades, setNovedades] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ tipo: 'VACACIONES', fecha_inicio: '', fecha_fin: '', con_goce: true, observacion: '' });

  const recargar = async () => {
    if (!empleado) return;
    setCargando(true);
    try {
      const data = await fetchNovedades(empleado.id_empleado);
      setNovedades(data.novedades || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!open || !empleado) return;
    setForm({ tipo: 'VACACIONES', fecha_inicio: '', fecha_fin: '', con_goce: true, observacion: '' });
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empleado?.id_empleado]);

  if (!open || !empleado) return null;

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const dias = diasEntre(form.fecha_inicio, form.fecha_fin);
  const rangoInvertido = form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio;

  const guardar = async (e) => {
    e.preventDefault();
    if (rangoInvertido) return;
    setGuardando(true);
    try {
      const result = await crearNovedad({
        id_empleado: empleado.id_empleado,
        tipo: form.tipo,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        con_goce: form.con_goce,
        observacion: form.observacion.trim()
      });
      showToast(result.message, 'success');
      setForm({ tipo: 'VACACIONES', fecha_inicio: '', fecha_fin: '', con_goce: true, observacion: '' });
      await recargar();
      onSaved?.();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (novedad) => {
    const ok = await confirm(`¿Eliminar esta novedad (${novedad.fecha_inicio} a ${novedad.fecha_fin})?`);
    if (!ok) return;
    try {
      const result = await eliminarNovedad(novedad.id_novedad);
      showToast(result.message, 'success');
      await recargar();
      onSaved?.();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-brand font-bold text-lg text-gray-900">Novedades del Colaborador</h3>
            <p className="text-xs text-gray-500">{empleado.nombre_completo}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-4 p-3 bg-gray-50 border border-gray-100 rounded-xl">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Tipo</label>
              <select value={form.tipo} onChange={set('tipo')} className={inputClass}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Desde *</label>
              <input type="date" required value={form.fecha_inicio} onChange={set('fecha_inicio')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hasta *</label>
              <input type="date" required value={form.fecha_fin} onChange={set('fecha_fin')} className={inputClass} />
            </div>
          </div>

          {rangoInvertido ? (
            <p className="text-[10px] text-red-600">La fecha de fin no puede ser anterior a la de inicio.</p>
          ) : dias > 0 ? (
            <p className="text-[10px] text-gray-500">{dias} {dias === 1 ? 'día' : 'días'} calendario.</p>
          ) : null}

          <div>
            <label className={labelClass}>Observación</label>
            <input
              type="text"
              value={form.observacion}
              onChange={set('observacion')}
              placeholder="ej. N° de certificado, motivo del permiso"
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={form.con_goce}
                onChange={(e) => setForm((f) => ({ ...f, con_goce: e.target.checked }))}
                className="accent-[#D81B60]"
              />
              Con goce de haber
            </label>
            <button type="submit" disabled={guardando} className="btn-bissu px-4 py-2 text-xs font-bold uppercase tracking-wider">
              {guardando ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </form>

        <div>
          <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">Registradas</h4>
          {cargando && <p className="text-xs text-gray-400 py-3">Cargando...</p>}
          {!cargando && novedades.length === 0 && <p className="text-xs text-gray-400 py-3">Sin novedades registradas.</p>}
          <div className="space-y-2">
            {novedades.map((n) => (
              <div key={n.id_novedad} className="flex items-center justify-between gap-3 p-2.5 border border-gray-100 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    {TIPOS.find((t) => t.value === n.tipo)?.label || n.tipo}
                    {!n.con_goce && <span className="ml-1 text-[10px] font-normal text-amber-700">(sin goce)</span>}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {n.fecha_inicio} a {n.fecha_fin} · {diasEntre(n.fecha_inicio, n.fecha_fin)} días
                    {n.observacion ? ` · ${n.observacion}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => borrar(n)}
                  className="px-2.5 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
