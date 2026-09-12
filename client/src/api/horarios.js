import { http } from './http';

export function fetchHorarioSemana(semanaInicio, idTienda) {
  return http.get(`/horarios/semana?semana_inicio=${semanaInicio}&id_tienda=${idTienda}`);
}

export function bulkUpdateHorarios(cambios) {
  return http.put('/horarios/bulk-update', { cambios });
}

export function crearSolicitud(semanaInicio, idTienda, motivo, cambios) {
  return http.post('/horarios/solicitudes', { semana_inicio: semanaInicio, id_tienda: idTienda, motivo, cambios });
}

export function fetchSolicitudes(estado) {
  const query = estado ? `?estado=${estado}` : '';
  return http.get(`/horarios/solicitudes${query}`);
}

// La versión viaja para que el servidor rechace la aprobación si la tienda
// corrigió la solicitud después de que el admin la abrió.
export function resolverSolicitud(idSolicitud, aprobar, comentario, cambios, version) {
  return http.post(`/horarios/solicitudes/${idSolicitud}/resolver`, { aprobar, comentario, cambios, version });
}

export function actualizarSolicitud(idSolicitud, motivo, cambios) {
  return http.put(`/horarios/solicitudes/${idSolicitud}`, { motivo, cambios });
}

export function updateDiaDescanso(idEmpleado, diaDescanso) {
  return http.put(`/horarios/empleados/${idEmpleado}/dia-descanso`, { dia_descanso: diaDescanso });
}

export function fetchNovedades(idEmpleado) {
  return http.get(`/horarios/empleados/${idEmpleado}/novedades`);
}

export function crearNovedad(payload) {
  return http.post('/horarios/novedades', payload);
}

export function eliminarNovedad(idNovedad) {
  return http.del(`/horarios/novedades/${idNovedad}`);
}
