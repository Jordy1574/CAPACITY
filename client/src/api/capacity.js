import { http } from './http';

export function fetchCapacity(mes, idTienda) {
  return http.get(`/capacity?mes=${mes}&id_tienda=${idTienda}`);
}

export function bulkUpdateCapacity(cambios) {
  return http.put('/capacity/bulk-update', { cambios });
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
