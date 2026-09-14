// Los cambios del horario viven en el estado de la página, así que salir a
// otro módulo (Capacity, por ejemplo) los perdía. Se guardan como borrador
// por sede y semana para poder retomarlos al volver.
const PREFIX = 'bissu_borrador_horario:';
// Un borrador viejo puede chocar con un horario que ya cambió; pasado un día
// se descarta solo.
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

function clave(storeId, weekStart) {
  return `${PREFIX}${storeId}_${weekStart}`;
}

export function leerBorrador(storeId, weekStart) {
  if (!storeId || !weekStart) return {};
  try {
    const crudo = localStorage.getItem(clave(storeId, weekStart));
    if (!crudo) return {};
    const { cambios, guardadoEn } = JSON.parse(crudo);
    if (!cambios || Date.now() - guardadoEn > VIGENCIA_MS) {
      localStorage.removeItem(clave(storeId, weekStart));
      return {};
    }
    return cambios;
  } catch {
    return {};
  }
}

export function guardarBorrador(storeId, weekStart, cambios) {
  if (!storeId || !weekStart) return;
  try {
    if (!cambios || Object.keys(cambios).length === 0) {
      localStorage.removeItem(clave(storeId, weekStart));
      return;
    }
    localStorage.setItem(clave(storeId, weekStart), JSON.stringify({ cambios, guardadoEn: Date.now() }));
  } catch {
    // Sin espacio o con el almacenamiento bloqueado: el borrador es una ayuda,
    // no puede romper la edición.
  }
}

export function limpiarBorrador(storeId, weekStart) {
  guardarBorrador(storeId, weekStart, null);
}
