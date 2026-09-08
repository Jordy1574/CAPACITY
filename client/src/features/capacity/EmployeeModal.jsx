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
  fecha_baja: ''
};

export default function EmployeeModal({ open, employee, tienda, empleados, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
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
        fecha_baja: employee.fecha_baja ? employee.fecha_baja.substring(0, 10) : ''
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, employee]);

  if (!open) return null;

  const options = computeAdvisorCodeOptions(tienda, empleados, employee?.codigo_empleado || null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const setSituacion = (e) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      situacion: value,
      fecha_baja: value === 'INACTIVO' && !f.fecha_baja ? new Date().toISOString().substring(0, 10) : f.fecha_baja
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      dni: form.dni.trim(),
      celular: form.celular.trim(),
      nombre_completo: form.nombre_completo.trim(),
      puesto: form.puesto,
      regimen: form.regimen,
      codigo_empleado: form.codigo_empleado,
      correo_asesor: form.correo_asesor.trim(),
      situacion: form.situacion,
      fecha_baja: form.fecha_baja,
      id_empleado: form.id_empleado
    });
  };

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
              onChange={set('nombre_completo')}
              placeholder="María Elena Torres"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
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

          <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Estado</label>
              <select value={form.situacion} onChange={setSituacion} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO (Baja / Retiro)</option>
              </select>
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
