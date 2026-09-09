export function addDaysToDateStr(dateStr, days) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).split('T')[0];
  const d = new Date(`${cleanStr}T00:00:00`);
  if (isNaN(d.getTime())) return cleanStr;
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Devuelve el lunes de la semana que contiene dateStr.
export function getMondayOf(dateStr) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).split('T')[0];
  const d = new Date(`${cleanStr}T00:00:00`);
  if (isNaN(d.getTime())) return cleanStr;
  const day = d.getDay(); // 0=domingo ... 6=sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDaysToDateStr(cleanStr, diffToMonday);
}

// Las 7 fechas (lunes a domingo) de la semana que empieza en weekStartStr.
export function getWeekDates(weekStartStr) {
  if (!weekStartStr) return [];
  const cleanStr = String(weekStartStr).split('T')[0];
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(cleanStr, i));
}

export function formatWeekLabel(weekDates) {
  if (!weekDates || !weekDates[0] || !weekDates[6]) return '';
  const startStr = String(weekDates[0]).split('T')[0];
  const endStr = String(weekDates[6]).split('T')[0];
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  if (start.getMonth() === end.getMonth()) {
    const mesFmt = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return `${start.getDate()} – ${end.getDate()} de ${mesFmt}`;
  }
  const startFmt = start.toLocaleDateString('es-ES', { month: 'long' });
  const endFmt = end.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return `${start.getDate()} de ${startFmt} – ${end.getDate()} de ${endFmt}`;
}
