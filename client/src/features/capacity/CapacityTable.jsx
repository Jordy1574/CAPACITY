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

// La celda ya no se edita: refleja el horario oficial (1 trabaja / 0 no).
function DayCell({ value }) {
  const vacio = value === null || value === undefined;
  return (
    <td className="p-1 border-b border-gray-100 text-center align-middle">
      <div
        className={`h-8 w-8 mx-auto rounded-lg flex items-center justify-center text-xs ${getBadgeClass(value)}`}
        title={vacio ? 'Sin horario oficial para este día' : undefined}
      >
        {vacio ? '-' : Number(value) > 0 ? '1' : '0'}
      </div>
    </td>
  );
}

export default function CapacityTable({ data, onEditEmployee }) {
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
              <th className="p-3 border-b border-gray-200 min-w-[80px] text-center bg-gray-50">Dotación</th>
              <th className="p-3 border-b border-gray-200 min-w-[90px] text-center bg-gray-50">Acciones</th>
              {days.map((d) => (
                <DayHeader key={d} dayStr={d} />
              ))}
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-gray-100">
            {empleados.length === 0 && (
              <tr>
                <td colSpan={days.length + 6} className="text-center py-10 text-gray-400 font-medium">
                  No hay colaboradores registrados en esta tienda para el mes seleccionado.
                </td>
              </tr>
            )}
            {empleados.map((emp) => {
              const isInactive = emp.situacion === 'INACTIVO';
              const noComisiona = emp.situacion === 'NO_COMISIONA';
              return (
                <tr key={emp.id_empleado} className={`hover:bg-gray-50/80 transition-colors ${isInactive ? 'bg-red-50/30' : ''}`}>
                  <td className="p-3 sticky-col-1 border-b border-gray-100 font-medium text-gray-900 bg-white">
                    <div>
                      <div className={`font-bold text-xs ${isInactive ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                        {emp.nombre_completo}
                        {isInactive && <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-normal no-underline">INACTIVO</span>}
                        {noComisiona && (
                          <span className="ml-1 text-[9px] px-1 bg-amber-100 text-amber-800 rounded font-normal" title="No comisiona: sus días de capacity quedan siempre en 0">
                            NO COMISIONA
                          </span>
                        )}
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
                      title={emp.regimen === 'PT' ? 'Part Time — dotación 0.5' : 'Full Time — dotación 1'}
                    >
                      {emp.regimen || 'FT'}
                    </span>
                  </td>
                  <td className="p-3 border-b border-gray-100 text-center font-mono font-bold text-gray-900 text-xs">
                    {Number(emp.dotacion ?? (emp.regimen === 'PT' ? 0.5 : 1)).toFixed(1)}
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
                  {days.map((dayStr) => (
                    <DayCell key={dayStr} value={emp.dias[dayStr]} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
