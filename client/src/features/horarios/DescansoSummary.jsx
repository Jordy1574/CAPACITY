import { calcularHorasTotales, DIA_DESCANSO_OPCIONES } from './coverage';

export default function DescansoSummary({ weekDates, empleados, pendingChanges, onChangeDiaDescanso }) {
  if (!empleados || empleados.length === 0) {
    return (
      <div className="antigravity-card bg-white p-4">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Descansos de la semana</h3>
        <p className="py-3 text-xs text-gray-400">No hay colaboradores registrados.</p>
      </div>
    );
  }

  return (
    <div className="antigravity-card bg-white p-4">
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Descansos de la semana</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] font-bold text-gray-500 uppercase border-b border-gray-200">
              <th className="py-2 pr-4">Colaborador</th>
              <th className="py-2 pr-4">Día de descanso</th>
              <th className="py-2 pr-2 text-right">Horas semana</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((emp) => {
              const weeklyTotal = weekDates.reduce((sum, dayStr) => {
                const key = `${emp.id_empleado}_${dayStr}`;
                const blocks = pendingChanges[key] !== undefined ? pendingChanges[key].turnos : emp.dias[dayStr];
                return sum + calcularHorasTotales(blocks);
              }, 0);

              return (
                <tr key={emp.id_empleado} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 font-semibold text-gray-800">{emp.nombre_completo}</td>
                  <td className="py-2 pr-4">
                    <select
                      value={emp.dia_descanso || ''}
                      onChange={(e) => onChangeDiaDescanso(emp.id_empleado, e.target.value, emp.nombre_completo)}
                      className="p-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
                    >
                      <option value="">— Sin asignar —</option>
                      {DIA_DESCANSO_OPCIONES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2 text-right font-bold text-gray-700">{weeklyTotal.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
