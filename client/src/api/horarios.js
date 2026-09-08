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

export function resolverSolicitud(idSolicitud, aprobar, comentario, cambios) {
  return http.post(`/horarios/solicitudes/${idSolicitud}/resolver`, { aprobar, comentario, cambios });
}

export function updateDiaDescanso(idEmpleado, diaDescanso) {
  return http.put(`/horarios/empleados/${idEmpleado}/dia-descanso`, { dia_descanso: diaDescanso });
}
