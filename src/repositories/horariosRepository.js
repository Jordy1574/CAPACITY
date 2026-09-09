const { query } = require('../config/db');

async function getSemana(idTienda, semanaInicio) {
  const rows = await query('SELECT * FROM horario_semanas WHERE id_tienda = $1 AND semana_inicio = $2', [idTienda, semanaInicio]);
  return rows[0] || { id_tienda: idTienda, semana_inicio: semanaInicio, confirmado_por: null, fecha_confirmacion: null };
}

function marcarConfirmado(idTienda, semanaInicio, idUsuario, queryFn = query) {
  return queryFn(
    `INSERT INTO horario_semanas (id_tienda, semana_inicio, confirmado_por, fecha_confirmacion)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (id_tienda, semana_inicio) DO UPDATE SET confirmado_por = $4, fecha_confirmacion = CURRENT_TIMESTAMP`,
    [idTienda, semanaInicio, idUsuario, idUsuario]
  );
}

function findTurnosForFechas(fechas, empIds) {
  const fechaPlaceholders = fechas.map((_, i) => `$${i + 1}`).join(',');
  const empPlaceholders = empIds.map((_, i) => `$${fechas.length + i + 1}`).join(',');
  const sql = `
    SELECT id_turno, id_empleado, CAST(fecha AS TEXT) AS fecha, hora_inicio, hora_fin
    FROM horario_turnos
    WHERE CAST(fecha AS TEXT) IN (${fechaPlaceholders}) AND id_empleado IN (${empPlaceholders})
    ORDER BY hora_inicio ASC
  `;
  return query(sql, [...fechas, ...empIds]);
}

function deleteTurnosForDia(idEmpleado, fecha, queryFn = query) {
  return queryFn('DELETE FROM horario_turnos WHERE id_empleado = $1 AND CAST(fecha AS TEXT) LIKE $2', [idEmpleado, `${fecha}%`]);
}

function insertTurno(idEmpleado, fecha, horaInicio, horaFin, idUsuario, queryFn = query) {
  return queryFn(
    'INSERT INTO horario_turnos (id_empleado, fecha, hora_inicio, hora_fin, usuario_modificacion, fecha_actualizacion) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
    [idEmpleado, fecha, horaInicio, horaFin, idUsuario]
  );
}

// --- Solicitudes (con turnos propuestos, no solo un motivo) ---

async function getSolicitudPendiente(idTienda, semanaInicio) {
  const rows = await query(
    "SELECT * FROM horario_solicitudes WHERE id_tienda = $1 AND semana_inicio = $2 AND estado = 'PENDIENTE' ORDER BY fecha_solicitud DESC",
    [idTienda, semanaInicio]
  );
  return rows[0] || null;
}

async function getCambiosDeSolicitud(idSolicitud) {
  const dias = await query('SELECT id_empleado, CAST(fecha AS TEXT) AS fecha FROM horario_solicitud_dias WHERE id_solicitud = $1', [idSolicitud]);
  const turnos = await query(
    'SELECT id_empleado, CAST(fecha AS TEXT) AS fecha, hora_inicio, hora_fin FROM horario_solicitud_turnos WHERE id_solicitud = $1 ORDER BY hora_inicio ASC',
    [idSolicitud]
  );

  const turnosPorDia = {};
  turnos.forEach(t => {
    const key = `${t.id_empleado}_${t.fecha}`;
    if (!turnosPorDia[key]) turnosPorDia[key] = [];
    turnosPorDia[key].push({ hora_inicio: t.hora_inicio, hora_fin: t.hora_fin });
  });

  return dias.map(d => ({
    id_empleado: d.id_empleado,
    fecha: d.fecha,
    turnos: turnosPorDia[`${d.id_empleado}_${d.fecha}`] || []
  }));
}

async function eliminarSolicitud(idSolicitud) {
  await query('DELETE FROM horario_solicitud_turnos WHERE id_solicitud = $1', [idSolicitud]);
  await query('DELETE FROM horario_solicitud_dias WHERE id_solicitud = $1', [idSolicitud]);
  await query('DELETE FROM horario_solicitudes WHERE id_solicitud = $1', [idSolicitud]);
}

async function eliminarSolicitudPendiente(idTienda, semanaInicio) {
  const existente = await getSolicitudPendiente(idTienda, semanaInicio);
  if (existente) {
    await eliminarSolicitud(existente.id_solicitud);
  }
}

async function crearSolicitud(idTienda, semanaInicio, motivo, idUsuario, cambios) {
  await eliminarSolicitudPendiente(idTienda, semanaInicio);

  const rows = await query(
    "INSERT INTO horario_solicitudes (id_tienda, semana_inicio, motivo, estado, solicitado_por) VALUES ($1, $2, $3, 'PENDIENTE', $4) RETURNING id_solicitud",
    [idTienda, semanaInicio, motivo, idUsuario]
  );
  const idSolicitud = rows[0].id_solicitud;

  for (const cambio of cambios) {
    await query('INSERT INTO horario_solicitud_dias (id_solicitud, id_empleado, fecha) VALUES ($1, $2, $3)', [idSolicitud, cambio.id_empleado, cambio.fecha]);
    for (const bloque of cambio.turnos) {
      await query(
        'INSERT INTO horario_solicitud_turnos (id_solicitud, id_empleado, fecha, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4, $5)',
        [idSolicitud, cambio.id_empleado, cambio.fecha, bloque.hora_inicio, bloque.hora_fin]
      );
    }
  }

  return idSolicitud;
}

function findSolicitudesConJoins({ idTienda, estado }) {
  let sql = `
    SELECT
      s.id_solicitud, s.id_tienda, s.semana_inicio, s.motivo, s.estado,
      s.fecha_solicitud, s.fecha_resolucion, s.comentario_resolucion,
      t.nombre_tienda, t.codigo_almacen,
      us.email AS solicitado_por_email,
      ur.email AS resuelto_por_email
    FROM horario_solicitudes s
    INNER JOIN tiendas t ON t.id_tienda = s.id_tienda
    LEFT JOIN usuarios us ON us.id_usuario = s.solicitado_por
    LEFT JOIN usuarios ur ON ur.id_usuario = s.resuelto_por
    WHERE 1=1
  `;
  const params = [];

  if (idTienda) {
    params.push(idTienda);
    sql += ` AND s.id_tienda = $${params.length}`;
  }

  if (estado) {
    params.push(estado);
    sql += ` AND s.estado = $${params.length}`;
  }

  sql += ` ORDER BY s.fecha_solicitud DESC`;

  return query(sql, params);
}

async function findSolicitudById(id) {
  const rows = await query('SELECT * FROM horario_solicitudes WHERE id_solicitud = $1', [id]);
  return rows[0] || null;
}

function resolverSolicitud(id, nuevoEstado, idUsuario, comentario) {
  return query(
    `UPDATE horario_solicitudes
     SET estado = $1, resuelto_por = $2, fecha_resolucion = CURRENT_TIMESTAMP, comentario_resolucion = $3
     WHERE id_solicitud = $4`,
    [nuevoEstado, idUsuario, comentario, id]
  );
}

module.exports = {
  getSemana,
  marcarConfirmado,
  findTurnosForFechas,
  deleteTurnosForDia,
  insertTurno,
  getSolicitudPendiente,
  getCambiosDeSolicitud,
  crearSolicitud,
  eliminarSolicitud,
  findSolicitudesConJoins,
  findSolicitudById,
  resolverSolicitud
};
