import { getToken, http } from './http';

export function fetchCapacity(mes, idTienda) {
  return http.get(`/capacity?mes=${mes}&id_tienda=${idTienda}`);
}

// La descarga no pasa por http() porque la respuesta es un archivo, no JSON.
export async function descargarCapacityCsv(mes, idTienda) {
  const res = await fetch(`/api/capacity/export.csv?mes=${mes}&id_tienda=${idTienda}`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo generar el archivo.');
  }

  const nombre = /filename="(.+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `capacity_${mes}.csv`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export function createEmpleado(payload) {
  return http.post('/empleados', payload);
}

export function updateEmpleado(idEmpleado, payload) {
  return http.put(`/empleados/${idEmpleado}`, payload);
}

export function fetchExportUrl(mes) {
  return http.get(`/capacity/export-url?mes=${mes}`);
}
