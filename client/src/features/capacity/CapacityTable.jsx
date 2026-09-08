import { getBadgeClass } from './cellCycle';

function DayHeader({ dayStr }) {
  const dayNum = dayStr.split('-')[2];
  const dateObj = new Date(`${dayStr}T00:00:00`);
  const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'narrow' }).toUpperCase();
  const isWeekend = [0, 6].includes(dateObj.getDay());

  return (
    <th className={`p-2 border-b border-gray-200 text-center min-w-[44px] ${isWeekend ? 'bg-pink-50/50 text-[#D81B60]' : 'bg-gray-50'}`}>
      <div className="text-[10px] opacity-60 font-semibold">{dayName}</div>
      <div className="text-xs font-bold">{dayNum}</div>
    </th>
  );
}

function DayCell({ value, isPending, onClick }) {
  return (
    <td className="p-1 border-b border-gray-100 text-center align-middle">
      <div
        onClick={onClick}
        className={`capacity-cell h-8 w-8 mx-auto rounded-lg flex items-center justify-center text-xs ${getBadgeClass(value)} ${isPending ? 'cell-modified' : ''}`}
      >
        {value !== null && value !== undefined ? Number(value).toFixed(1) : '-'}
      </div>
    </td>
  );
}

export default function CapacityTable({ data, pendingChanges, onCellClick, onEditEmployee }) {
  const days = data?.dias_mes || [];
  const empleados = data?.empleados || [];

  return (
    <div className="antigravity-card bg-white p-3">
      <div className="table-container max-h-[650px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-30 shadow-sm">
            <tr>
              <th className="p-3 sticky-col-1 border-b border-gray-200 min-w-[210px] bg-gray-50">Colaborador</th>
              <th className="p-3 sticky-col-2 border-b border-gray-200 min-w-[110px] bg-gray-50 text-center">Código Asesor</th>
              <th className="p-3 border-b border-gray-200 min-w-[140px] bg-gray-50">Puesto</th>
              <th className="p-3 border-b border-gray-200 min-w-[80px] text-center bg-gray-50">Régimen</th>
              <th className="p-3 border-b border-gray-200 min-w-[90px] text-center bg-gray-50">Acciones</th>
              {days.map((d) => (
                <DayHeader key={d} dayStr={d} />
              ))}
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-gray-100">
            {empleados.length === 0 && (
              <tr>
                <td colSpan={days.length + 5} className="text-center py-10 text-gray-400 font-medium">
                  No hay colaboradores registrados en esta tienda para el mes seleccionado.
                </td>
              </tr>
            )}
            {empleados.map((emp) => {
              const isInactive = emp.situacion === 'INACTIVO';
              return (
                <tr key={emp.id_empleado} className={`hover:bg-gray-50/80 transition-colors ${isInactive ? 'bg-red-50/30' : ''}`}>
                  <td className="p-3 sticky-col-1 border-b border-gray-100 font-medium text-gray-900 bg-white">
                    <div>
                      <div className={`font-bold text-xs ${isInactive ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                        {emp.nombre_completo}
                        {isInactive && <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-normal no-underline">INACTIVO</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        DNI: {emp.dni} {emp.celular ? ` | Cel: ${emp.celular}` : ''}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 sticky-col-2 border-b border-gray-100 text-center bg-white">
                    {emp.codigo_empleado ? (
                      <span className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-mono font-bold rounded-lg shadow-xs border border-gray-800">
                        {emp.codigo_empleado}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg">EN PRUEBA</span>
                    )}
                  </td>
                  <td className="p-3 border-b border-gray-100 text-gray-700 text-xs font-semibold">{emp.puesto || 'ASESOR DE VENTAS'}</td>
                  <td className="p-3 border-b border-gray-100 text-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                        emp.regimen === 'FT' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                      title={emp.regimen === 'FT' ? 'Full Time (1.0 -> 0.0 -> 0.5 -> Vacío)' : 'Part Time (0.5 -> 0.0 -> 1.0 -> Vacío)'}
                    >
                      {emp.regimen || 'FT'}
                    </span>
                  </td>
                  <td className="p-3 border-b border-gray-100 text-center">
                    <button
                      onClick={() => onEditEmployee(emp)}
                      className="btn-edit-emp inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-bold text-[#D81B60] bg-pink-50 hover:bg-[#D81B60] hover:text-white border border-pink-200 rounded-lg transition-all shadow-xs"
                      title="Editar datos del colaborador / Asignar código / Registrar baja"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z" />
                      </svg>
                      <span>Editar</span>
                    </button>
                  </td>
                  {days.map((dayStr) => {
                    const key = `${emp.id_empleado}_${dayStr}`;
                    const isPending = pendingChanges[key] !== undefined;
                    const currentVal = isPending ? pendingChanges[key].valor : emp.dias[dayStr];
                    return (
                      <DayCell
                        key={dayStr}
                        value={currentVal}
                        isPending={isPending}
                        onClick={() => onCellClick(emp.id_empleado, dayStr, emp.dias[dayStr], emp.regimen)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
