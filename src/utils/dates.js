function getDaysInMonth(yearMonthStr) {
  const [year, month] = yearMonthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const days = [];
  while (date.getMonth() === month - 1) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function addDaysToDateStr(dateStr, days) {
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
function getMondayOf(dateStr) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).split('T')[0];
  const d = new Date(`${cleanStr}T00:00:00`);
  if (isNaN(d.getTime())) return cleanStr;
  const day = d.getDay(); // 0=domingo ... 6=sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDaysToDateStr(cleanStr, diffToMonday);
}

// Las 7 fechas (lunes a domingo) de la semana que empieza en weekStartStr.
function getWeekDates(weekStartStr) {
  if (!weekStartStr) return [];
  const cleanStr = String(weekStartStr).split('T')[0];
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(cleanStr, i));
}

function todayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

module.exports = { getDaysInMonth, addDaysToDateStr, getMondayOf, getWeekDates, todayStr };
