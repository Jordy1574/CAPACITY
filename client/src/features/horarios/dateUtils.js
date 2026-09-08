export function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Devuelve el lunes de la semana que contiene dateStr.
export function getMondayOf(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDay(); // 0=domingo ... 6=sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDaysToDateStr(dateStr, diffToMonday);
}

// Las 7 fechas (lunes a domingo) de la semana que empieza en weekStartStr.
export function getWeekDates(weekStartStr) {
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(weekStartStr, i));
}

export function formatWeekLabel(weekDates) {
  const start = new Date(`${weekDates[0]}T00:00:00`);
  const end = new Date(`${weekDates[6]}T00:00:00`);

  if (start.getMonth() === end.getMonth()) {
    const mesFmt = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return `${start.getDate()} – ${end.getDate()} de ${mesFmt}`;
  }
  const startFmt = start.toLocaleDateString('es-ES', { month: 'long' });
  const endFmt = end.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return `${start.getDate()} de ${startFmt} – ${end.getDate()} de ${endFmt}`;
}
