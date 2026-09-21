// Plazas de la sede: el rango de códigos dice cuántas hay ('0040-0049' = 10).
function plazasDeLaSede(tienda) {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(tienda?.rango_codigos || '').trim());
  if (!m) return null;
  return parseInt(m[2], 10) - parseInt(m[1], 10) + 1;
}

export default function CapacityKpis({ data }) {
  const resumen = data?.resumen || {};
  const conCodigo = (data?.empleados || []).filter((e) => e.codigo_empleado).length;
  const plazas = plazasDeLaSede(data?.tienda);

  const cards = [
    {
      label: 'Personal Activo',
      value: resumen.total_empleados || 0,
      sub: plazas ? `Plazas asignadas: ${conCodigo} / ${plazas}` : `Plazas asignadas: ${conCodigo}`,
      iconBg: 'bg-pink-50 text-[#D81B60]',
      valueClass: 'text-gray-900',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
    },
    // El porcentaje de "Capacity del Mes" queda fuera hasta definir sobre qué
    // base se calcula: con los días del mes completo siempre se ve bajo a
    // mitad de mes, porque las semanas que faltan cargar cuentan como no
    // trabajadas. El backend lo sigue devolviendo en `promedio_capacity`.
    {
      label: 'Días Trabajados',
      value: resumen.dias_trabajados || 0,
      sub: `${resumen.colaboradores_activos || 0} colaboradores que comisionan`,
      iconBg: 'bg-emerald-50 text-emerald-600',
      valueClass: 'text-gray-900',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      label: 'Días con Horario',
      value: resumen.dias_con_registro || 0,
      sub: 'Días ya cargados del mes',
      iconBg: 'bg-amber-50 text-amber-600',
      valueClass: 'text-gray-900',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="antigravity-card p-5 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{c.label}</span>
            <div className={`p-2 rounded-xl ${c.iconBg}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={c.icon} />
              </svg>
            </div>
          </div>
          <p className={`text-2xl font-black font-brand ${c.valueClass}`}>{c.value}</p>
          <span className="text-[11px] text-gray-500 font-medium">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}
