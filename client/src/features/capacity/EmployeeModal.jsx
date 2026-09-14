import { useEffect, useState } from 'react';
import { computeAdvisorCodeOptions } from './cellCycle';

const EMPTY_FORM = {
  id_empleado: '',
  dni: '',
  celular: '',
  nombre_completo: '',
  puesto: 'ASESOR DE VENTAS',
  regimen: 'FT',
  codigo_empleado: '',
  correo_asesor: '',
  situacion: 'ACTIVO',
  fecha_ingreso: '',
  fecha_baja: ''
};

export default function EmployeeModal({ open, employee, tienda, empleados, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  // Cuando el DNI ya existe en otra sede, el backend responde 409 con las
  // fichas encontradas y acá se pregunta si es apoyo o traslado.
  const [conflicto, setConflicto] = useState(null);

  useEffect(() => {
    if (!open) return;
    setConflicto(null);
    if (employee) {
      setForm({
        id_empleado: employee.id_empleado,
        dni: employee.dni || '',
        celular: employee.celular || '',
        nombre_completo: employee.nombre_completo || '',
        puesto: employee.puesto || 'ASESOR DE VENTAS',
        regimen: employee.regimen || 'FT',
        codigo_empleado: employee.codigo_empleado || '',
        correo_asesor: employee.correo_asesor || '',
        situacion: employee.situacion || 'ACTIVO',
        fecha_ingreso: employee.fecha_ingreso ? employee.fecha_ingreso.substring(0, 10) : '',
        fecha_baja: employee.fecha_baja ? employee.fecha_baja.substring(0, 10) : ''
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, employee]);

  if (!open) return null;

  const options = computeAdvisorCodeOptions(tienda, empleados, employee?.codigo_empleado || null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  // Los nombres se guardan en mayúsculas; se muestran así desde que se escriben
  // para que el formulario no "cambie" el dato al guardar.
  const setNombre = (e) => setForm((f) => ({ ...f, nombre_completo: e.target.value.toUpperCase() }));

  const setSituacion = (e) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      situacion: value,
      fecha_baja: value === 'INACTIVO' && !f.fecha_baja ? new Date().toISOString().substring(0, 10) : f.fecha_baja
    }));
  };

  const construirPayload = (modoTraslado = null) => ({
    dni: form.dni.trim(),
    celular: form.celular.trim(),
    nombre_completo: form.nombre_completo.trim().toUpperCase(),
    puesto: form.puesto,
    regimen: form.regimen,
    codigo_empleado: form.codigo_empleado,
    correo_asesor: form.correo_asesor.trim(),
    situacion: form.situacion,
    fecha_ingreso: form.fecha_ingreso,
    fecha_baja: form.fecha_baja,
    id_empleado: form.id_empleado,
    ...(modoTraslado ? { modo_traslado: modoTraslado } : {})
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const detalle = await onSubmit(construirPayload());
    if (detalle?.requiere_definir_modo) {
      // Se completan los datos personales con los que ya están registrados
      // para que ambas fichas queden idénticas.
      setForm((f) => ({
        ...f,
        nombre_completo: detalle.persona.nombre_completo || f.nombre_completo,
        celular: f.celular || detalle.persona.celular || '',
        correo_asesor: f.correo_asesor || detalle.persona.correo_asesor || '',
        regimen: detalle.persona.regimen || f.regimen
      }));
      setConflicto(detalle);
    }
  };

  const confirmarModo = async (modo) => {
    if (modo === 'APOYO' && !form.codigo_empleado) {
      return;
    }
    const detalle = await onSubmit(construirPayload(modo));
    if (!detalle?.requiere_definir_modo) setConflicto(null);
  };

  if (conflicto) {
    const sedes = conflicto.fichas.map((f) => f.nombre_tienda).join(', ');
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="antigravity-card bg-white max-w-lg w-full p-6 space-y-4">
          <div className="flex items-start gap-3 border-b border-gray-100 pb-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-brand font-bold text-lg text-gray-900">Este DNI ya está registrado</h3>
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{conflicto.persona.nombre_completo}</span> figura en {sedes}.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {conflicto.fichas.map((f) => (
              <div key={f.id_tienda} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs">
                <span className="font-semibold text-gray-700">{f.nombre_tienda}</span>
                <span className="text-gray-500">
                  Código {f.codigo_empleado || '—'} · {f.situacion === 'ACTIVO' ? 'Activo' : f.situacion}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              Código de vendedor en {tienda?.nombre_tienda || 'esta sede'} *
            </label>
            <select
              value={form.codigo_empleado}
              onChange={set('codigo_empleado')}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
            >
              <option value="">(Selecciona un código)</option>
              {options.map((opt) => (
                <option key={opt.code} value={opt.code} disabled={opt.isOccupied}>
                  {opt.code} {opt.isEncargada ? '(Encargada)' : ''} {opt.isOccupied ? '- (Ocupado)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400">
              Cada sede usa su propio rango: la misma persona lleva un código distinto en cada tienda donde apoya.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => confirmarModo('APOYO')}
              disabled={saving || !form.codigo_empleado}
              className="w-full text-left p-3 rounded-xl border-2 border-[#D81B60] bg-pink-50/50 hover:bg-pink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <p className="text-xs font-bold text-[#D81B60] uppercase tracking-wider">Es un apoyo</p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Sigue activo en su sede de origen y se le abre una ficha acá con el código elegido.
              </p>
            </button>
            <button
              type="button"
              onClick={() => confirmarModo('TRASLADO')}
              disabled={saving}
              className="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Es un traslado</p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Se da de baja en {sedes} y queda solo en esta sede.
              </p>
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={() => setConflicto(null)} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
              Volver al formulario
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-pink-50 text-[#D81B60] rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-brand font-bold text-lg text-gray-900">{employee ? 'Editar Colaborador' : 'Agregar Nuevo Colaborador'}</h3>
              <p className="text-xs text-gray-500">Registra un nuevo colaborador o actualiza sus códigos tras la prueba.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">DNI *</label>
              <input
                type="text"
                required
                maxLength={15}
                value={form.dni}
                onChange={set('dni')}
                placeholder="71234567"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Nº Celular *</label>
              <input
                type="tel"
                required
                value={form.celular}
                onChange={set('celular')}
                placeholder="987654321"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Nombre Completo *</label>
            <input
              type="text"
              required
              value={form.nombre_completo}
              onChange={setNombre}
              placeholder="MARÍA ELENA TORRES"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs uppercase outline-none focus:ring-2 focus:ring-[#D81B60]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Puesto</label>
              <select value={form.puesto} onChange={set('puesto')} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
                <option value="ASESOR DE VENTAS">ASESOR DE VENTAS</option>
                <option value="ENCARGADA DE TIENDA">ENCARGADA DE TIENDA</option>
                <option value="CAJERA">CAJERA</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Régimen</label>
              <select value={form.regimen} onChange={set('regimen')} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
                <option value="FT">Full Time (FT)</option>
                <option value="PT">Part Time (PT)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Código Asesor (Plaza)</label>
              <select value={form.codigo_empleado} onChange={set('codigo_empleado')} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
                <option value="">(Sin Código - Días de Prueba)</option>
                {options.map((opt) => (
                  <option key={opt.code} value={opt.code} disabled={opt.isOccupied}>
                    {opt.code} {opt.isEncargada ? '(Encargada)' : ''} {opt.isOccupied ? '- (Ocupado)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Correo Asesor</label>
              <input
                type="email"
                value={form.correo_asesor}
                onChange={set('correo_asesor')}
                placeholder="ej. mtorres.0100@bissu.pe"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Fecha de Ingreso</label>
            <input
              type="date"
              value={form.fecha_ingreso}
              onChange={set('fecha_ingreso')}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              No aparecerá en el capacity de los meses anteriores a esta fecha. Déjalo vacío si ya venía trabajando.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Estado</label>
              <select value={form.situacion} onChange={setSituacion} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
                <option value="ACTIVO">ACTIVO</option>
                <option value="NO_COMISIONA">NO COMISIONA</option>
                <option value="INACTIVO">INACTIVO (Baja / Retiro)</option>
              </select>
              {form.situacion === 'NO_COMISIONA' && (
                <p className="text-[10px] text-amber-700 mt-1">
                  Se le arma horario igual, pero sus días de capacity quedan siempre en 0.
                </p>
              )}
            </div>
            {form.situacion === 'INACTIVO' && (
              <div>
                <label className="block text-[11px] font-bold text-red-600 uppercase tracking-wider mb-1">Fecha de Baja</label>
                <input
                  type="date"
                  value={form.fecha_baja}
                  onChange={set('fecha_baja')}
                  className="w-full p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-bissu px-5 py-2 text-xs font-bold uppercase tracking-wider">
              {saving ? 'Guardando...' : 'Guardar Colaborador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
