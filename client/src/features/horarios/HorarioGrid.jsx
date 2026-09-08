import { Fragment } from 'react';
import { EMPLOYEE_COLOR_PALETTE, HORARIO_HOUR_START, HORARIO_HOUR_END, coverageForHour, calcularHorasTotales, formatRangoHora } from './coverage';

// La grilla siempre permite hacer clic: si la semana ya tiene horario oficial,
// lo que se edita queda como una propuesta local (solicitud de cambio) en vez
// de guardarse en vivo — la decisión de a dónde va el guardado la toma quien
// use este componente (HorariosPage / SolicitudReviewOverlay), no la grilla.
export default function HorarioGrid({ weekDates, empleados, pendingChanges, onCellClick }) {
  const totalCols = weekDates.length * Math.max(empleados.length, 1);

  if (empleados.length === 0) {
    return (
      <div className="antigravity-card bg-white p-3">
        <div className="table-container max-h-[650px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-2 sticky-col-1 border-b border-gray-200 min-w-[130px] bg-gray-50">Hora</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={totalCols + 1} className="text-center py-10 text-gray-400 font-medium">
                  No hay colaboradores registrados en esta tienda.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const empColors = {};
  empleados.forEach((emp, i) => {
    empColors[emp.id_empleado] = EMPLOYEE_COLOR_PALETTE[i % EMPLOYEE_COLOR_PALETTE.length];
  });

  const hours = [];
  for (let h = HORARIO_HOUR_START; h < HORARIO_HOUR_END; h++) hours.push(h);

  return (
    <div className="antigravity-card bg-white p-3">
      <div className="table-container max-h-[650px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-30 shadow-sm">
            <tr>
              <th className="p-2 sticky-col-1 border-b border-gray-200 min-w-[130px] bg-gray-50">Hora</th>
              {weekDates.map((dayStr, dayIndex) => {
                const dateObj = new Date(`${dayStr}T00:00:00`);
                const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').toUpperCase();
                const dayNum = dayStr.split('-')[2];
                const isWeekend = [0, 6].includes(dateObj.getDay());
                return (
                  <Fragment key={dayStr}>
                    {dayIndex > 0 && <th className="p-0 border-0 bg-white" style={{ width: 10, minWidth: 10 }} rowSpan={2} />}
                    <th
                      colSpan={empleados.length}
                      className={`p-2 border-b border-gray-200 text-center whitespace-nowrap ${isWeekend ? 'bg-pink-50/50 text-[#D81B60]' : 'bg-gray-50'}`}
                    >
                      {dayName} {dayNum}
                    </th>
                  </Fragment>
                );
              })}
            </tr>
            <tr>
              <th className="p-2 sticky-col-1 border-b border-gray-200 min-w-[130px] bg-gray-50"></th>
              {weekDates.map((dayStr) => (
                // Sin espaciador aquí: el <th> espaciador de la fila de arriba
                // ya tiene rowSpan={2} y cubre esta fila también. Agregar otro
                // aquí desalinearía las columnas del resto de la tabla.
                <Fragment key={dayStr}>
                  {empleados.map((emp) => {
                    const color = empColors[emp.id_empleado];
                    const isPending = pendingChanges[`${emp.id_empleado}_${dayStr}`] !== undefined;
                    return (
                      <th
                        key={`${dayStr}-${emp.id_empleado}`}
                        className={`relative p-1 border-b border-l border-gray-300/60 text-center font-semibold text-[9px] ${isPending ? 'cell-modified' : ''}`}
                        style={{ backgroundColor: color.bg, color: color.text, minWidth: 42 }}
                        title={`${emp.nombre_completo} — ${emp.puesto || ''} — ${emp.regimen || ''}${emp.codigo_empleado ? ` — Código: ${emp.codigo_empleado}` : ''}`}
                      >
                        {(emp.nombre_completo || '').split(' ')[0]}
                      </th>
                    );
                  })}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-gray-100">
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="p-1 sticky-col-1 border-b border-gray-100 text-[10px] font-bold text-gray-500 bg-white text-center whitespace-nowrap">
                  {formatRangoHora(hour)}
                </td>
                {weekDates.map((dayStr, dayIndex) => {
                  return (
                    <Fragment key={dayStr}>
                      {dayIndex > 0 && <td className="p-0 border-0 bg-white" style={{ width: 10, minWidth: 10 }} />}
                      {empleados.map((emp) => {
                        const key = `${emp.id_empleado}_${dayStr}`;
                        const isPending = pendingChanges[key] !== undefined;
                        const blocks = isPending ? pendingChanges[key].turnos : emp.dias[dayStr];
                        const coverage = coverageForHour(blocks, hour * 60);
                        const color = empColors[emp.id_empleado];

                        let style = {};
                        let text = '';
                        if (coverage) {
                          const fraction = (coverage.endPct - coverage.startPct) / 100;
                          text = fraction >= 1 ? '1' : fraction.toFixed(1);
                          style.color = color.text;
                          if (coverage.startPct <= 0 && coverage.endPct >= 100) {
                            style.backgroundColor = color.bg;
                          } else {
                            style.background = `linear-gradient(180deg, transparent ${coverage.startPct}%, ${color.bg} ${coverage.startPct}%, ${color.bg} ${coverage.endPct}%, transparent ${coverage.endPct}%)`;
                          }
                        }

                        return (
                          <td
                            key={`${hour}-${dayStr}-${emp.id_empleado}`}
                            className="relative p-0 h-6 border-b border-l border-gray-200 text-center text-[9px] font-bold cursor-pointer"
                            style={style}
                            title={blocks && blocks.length > 0 ? `${emp.nombre_completo}: ${blocks.map((b) => `${b.hora_inicio}–${b.hora_fin}`).join(', ')}` : undefined}
                            onClick={() => onCellClick(emp.id_empleado, emp.nombre_completo, dayStr, blocks)}
                          >
                            {text}
                          </td>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="p-1 sticky-col-1 border-t-2 border-gray-300 text-[10px] font-bold text-gray-700 bg-gray-50 text-center">Horas</td>
              {weekDates.map((dayStr, dayIndex) => (
                <Fragment key={dayStr}>
                  {dayIndex > 0 && <td className="p-0 border-0 bg-white" style={{ width: 10, minWidth: 10 }} />}
                  {empleados.map((emp) => {
                    const key = `${emp.id_empleado}_${dayStr}`;
                    const isPending = pendingChanges[key] !== undefined;
                    const blocks = isPending ? pendingChanges[key].turnos : emp.dias[dayStr];
                    const total = calcularHorasTotales(blocks);
                    return (
                      <td key={`total-${dayStr}-${emp.id_empleado}`} className="p-1 border-t-2 border-l border-gray-300 text-center text-[10px] font-bold text-gray-600 bg-gray-50">
                        {total > 0 ? total.toFixed(1) : '-'}
                      </td>
                    );
                  })}
                </Fragment>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
