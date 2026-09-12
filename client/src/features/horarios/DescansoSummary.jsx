import {
  calcularHorasTotales,
  horasContratoDe,
  DIA_DESCANSO_OPCIONES,
  DIA_DESCANSO_A_INDICE
} from './coverage';

const TIPO_NOVEDAD_LABEL = {
  VACACIONES: 'Vacaciones',
  DESCANSO_MEDICO: 'Descanso médico',
  FALTA: 'Falta',
  PERMISO: 'Permiso',
  LICENCIA: 'Licencia'
};

const TIPO_NOVEDAD_CLASE = {
  VACACIONES: 'bg-sky-50 text-sky-700 border-sky-200',
  DESCANSO_MEDICO: 'bg-violet-50 text-violet-700 border-violet-200',
  FALTA: 'bg-red-50 text-red-700 border-red-200',
  PERMISO: 'bg-amber-50 text-amber-700 border-amber-200',
  LICENCIA: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

// Días de la semana en que el colaborador realmente tiene turnos, para
// contrastarlos con el día de descanso declarado.
function diasConTurno(emp, weekDates, pendingChanges) {
  return weekDates.filter((dayStr) => {
    const key = `${emp.id_empleado}_${dayStr}`;
    const blocks = pendingChanges[key] !== undefined ? pendingChanges[key].turnos : emp.dias[dayStr];
    return (blocks || []).length > 0;
  });
}

export default function DescansoSummary({ weekDates, empleados, pendingChanges, onChangeDiaDescanso, onVerNovedades }) {
  if (!empleados || empleados.length === 0) {
    return (
      <div className="antigravity-card bg-white p-4">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Resumen de la semana</h3>
        <p className="py-3 text-xs text-gray-400">No hay colaboradores registrados.</p>
      </div>
    );
  }

  return (
    <div className="antigravity-card bg-white p-4">
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Resumen de la semana</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] font-bold text-gray-500 uppercase border-b border-gray-200">
              <th className="py-2 pr-4">Colaborador</th>
              <th className="py-2 pr-4">Día de descanso</th>
              <th className="py-2 pr-2 text-right">Horas</th>
              <th className="py-2 pr-2 text-right">Contrato</th>
              <th className="py-2 pr-2 text-right">Extras</th>
              <th className="py-2 pr-2">Novedades</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((emp) => {
              let horas = 0;
              weekDates.forEach((dayStr) => {
                const key = `${emp.id_empleado}_${dayStr}`;
                const blocks = pendingChanges[key] !== undefined ? pendingChanges[key].turnos : emp.dias[dayStr];
                horas += calcularHorasTotales(blocks);
              });

              const contrato = horasContratoDe(emp);
              const diferencia = horas - contrato;
              const trabajados = diasConTurno(emp, weekDates, pendingChanges);

              // El descanso declarado debería caer en un día sin turnos.
              const indiceDescanso = DIA_DESCANSO_A_INDICE[emp.dia_descanso];
              const descansoIncumplido =
                emp.dia_descanso &&
                trabajados.some((d) => new Date(`${d}T00:00:00`).getDay() === indiceDescanso);
              const sinDescanso = trabajados.length === weekDates.length;

              const novedades = emp.novedades || [];

              return (
                <tr key={emp.id_empleado} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 font-semibold text-gray-800">{emp.nombre_completo}</td>
                  <td className="py-2 pr-4">
                    <select
                      value={emp.dia_descanso || ''}
                      onChange={(e) => onChangeDiaDescanso(emp.id_empleado, e.target.value, emp.nombre_completo)}
                      className={`p-1.5 bg-gray-50 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#D81B60] ${
                        descansoIncumplido ? 'border-amber-400 text-amber-800' : 'border-gray-200'
                      }`}
                      title={descansoIncumplido ? 'Tiene turno asignado en su día de descanso' : undefined}
                    >
                      <option value="">— Sin asignar —</option>
                      {DIA_DESCANSO_OPCIONES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {sinDescanso && (
                      <span className="ml-2 text-[10px] font-bold text-red-600" title="Los 7 días tienen turno asignado">
                        Sin descanso
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right font-bold text-gray-700">{horas.toFixed(1)}</td>
                  <td className="py-2 pr-2 text-right text-gray-400">{contrato.toFixed(1)}</td>
                  <td className="py-2 pr-2 text-right font-bold">
                    {diferencia > 0.01 ? (
                      <span className="text-amber-700" title="Horas por encima de la jornada pactada">
                        +{diferencia.toFixed(1)}
                      </span>
                    ) : diferencia < -0.01 ? (
                      <span className="text-gray-400" title="Horas por debajo de la jornada pactada">
                        {diferencia.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-emerald-600">0.0</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {novedades.map((n) => (
                        <span
                          key={n.id_novedad}
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${TIPO_NOVEDAD_CLASE[n.tipo] || ''}`}
                          title={`${n.fecha_inicio} a ${n.fecha_fin}${n.observacion ? ` — ${n.observacion}` : ''}`}
                        >
                          {TIPO_NOVEDAD_LABEL[n.tipo] || n.tipo}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => onVerNovedades(emp)}
                        className="px-1.5 py-0.5 text-[10px] font-bold text-gray-500 hover:text-[#D81B60] hover:bg-pink-50 rounded"
                      >
                        {novedades.length > 0 ? 'Editar' : '+ Agregar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
