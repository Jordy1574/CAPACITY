export const HORARIO_HOUR_START = 7; // 07:00
export const HORARIO_HOUR_END = 23; // 23:00 (exclusivo) — última fila es 22:00-23:00

// Paleta cíclica para distinguir colaboradores en la grilla semanal. No
// empieza en rosa/magenta a propósito: ese es el color de marca/acento de la
// app (fines de semana, botones, indicador de cambio pendiente), y si el
// primer colaborador también fuera rosa se vería como si tuviera un estado
// especial en vez de ser solo "el primero de la lista".
export const EMPLOYEE_COLOR_PALETTE = [
  { bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' },
  { bg: '#FFF3E0', text: '#EF6C00', border: '#FFE0B2' },
  { bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' },
  { bg: '#F3E5F5', text: '#6A1B9A', border: '#E1BEE7' },
  { bg: '#FFFDE7', text: '#F9A825', border: '#FFF9C4' },
  { bg: '#E0F7FA', text: '#00838F', border: '#B2EBF2' },
  { bg: '#EFEBE9', text: '#4E342E', border: '#D7CCC8' },
  { bg: '#ECEFF1', text: '#455A64', border: '#CFD8DC' }
];

// Formatea una hora (0-23) en 12 horas con am/pm, ej. formatHora12(7) -> {text:'7:00', suffix:'am'}
export function formatHora12(hour) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { text: `${h12}:00`, suffix: hour < 12 ? 'am' : 'pm' };
}

// Etiqueta de la fila de hora, ej. "7:00 - 8:00 am" o, si cruza el mediodía,
// "11:00 am - 12:00 pm".
export function formatRangoHora(hourStart) {
  const start = formatHora12(hourStart);
  const end = formatHora12(hourStart + 1);
  if (start.suffix === end.suffix) {
    return `${start.text} - ${end.text} ${end.suffix}`;
  }
  return `${start.text} ${start.suffix} - ${end.text} ${end.suffix}`;
}

export function horaAMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function calcularHorasTotales(blocks) {
  return (blocks || []).reduce((sum, b) => sum + (horaAMinutos(b.hora_fin) - horaAMinutos(b.hora_inicio)), 0) / 60;
}

// Qué parte (0-100%) de la hora [hourStartMin, hourStartMin+60) cubren los
// bloques de turno. Devuelve null si no cubren nada, o {startPct, endPct}
// indicando desde/hasta dónde pintar la celda (un turno que empieza a mitad
// de hora debe pintarse abajo, uno que termina a mitad de hora debe
// pintarse arriba — no basta con saber "cuántos minutos", importa cuáles).
export function coverageForHour(blocks, hourStartMin) {
  const hourEndMin = hourStartMin + 60;
  let start = null;
  let end = null;
  (blocks || []).forEach((b) => {
    const overlapStart = Math.max(horaAMinutos(b.hora_inicio), hourStartMin);
    const overlapEnd = Math.min(horaAMinutos(b.hora_fin), hourEndMin);
    if (overlapEnd > overlapStart) {
      if (start === null || overlapStart < start) start = overlapStart;
      if (end === null || overlapEnd > end) end = overlapEnd;
    }
  });
  if (start === null) return null;
  return { startPct: ((start - hourStartMin) / 60) * 100, endPct: ((end - hourStartMin) / 60) * 100 };
}

export const DIA_DESCANSO_OPCIONES = [
  { value: 'LUNES', label: 'Lunes' },
  { value: 'MARTES', label: 'Martes' },
  { value: 'MIERCOLES', label: 'Miércoles' },
  { value: 'JUEVES', label: 'Jueves' },
  { value: 'VIERNES', label: 'Viernes' },
  { value: 'SABADO', label: 'Sábado' },
  { value: 'DOMINGO', label: 'Domingo' }
];

// new Date().getDay(): 0=domingo ... 6=sábado.
export const DIA_DESCANSO_A_INDICE = { DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };

export function labelDiaDescanso(valor) {
  return DIA_DESCANSO_OPCIONES.find((o) => o.value === valor)?.label || valor;
}
