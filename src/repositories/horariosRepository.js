const { query } = require('../config/db');

async function getPeriodo(idTienda, mes) {
  const rows = await query('SELECT * FROM horario_periodos WHERE id_tienda = $1 AND mes = $2', [idTienda, mes]);
  return rows[0] || { id_tienda: idTienda, mes, estado: 'BORRADOR', fecha_envio: null, usuario_envio: null };
}

async function getSolicitudPendiente(idTienda, mes) {
  const rows = await query(
    "SELECT * FROM horario_solicitudes WHERE id_tienda = $1 AND mes = $2 AND estado = 'PENDIENTE' ORDER BY fecha_solicitud DESC",
    [idTienda, mes]
  );
  return rows[0] || null;
}

function findTurnosForEmpleados(mes, empIds) {
  const placeholders = empIds.map((_, i) => `$${i + 2}`).join(',');
  // Importante: el driver SQLite de query() convierte $N a '?' posicional según
  // el orden en que aparecen EN EL TEXTO (no por su número), así que $1 debe
  // aparecer primero en el SQL para que coincida con el primer elemento del
  // array de params (ver query() en src/config/db.js).
  const sql = `
    SELECT id_turno, id_empleado, CAST(fecha AS TEXT) AS fecha, hora_inicio, hora_fin
    FROM horario_turnos
    WHERE CAST(fecha AS TEXT) LIKE $1 AND id_empleado IN (${placeholders})
    ORDER BY hora_inicio ASC
  `;
  return query(sql, [`${mes}%`, ...empIds]);
}

function deleteTurnosForDia(idEmpleado, fecha) {
  return query('DELETE FROM horario_turnos WHERE id_empleado = $1 AND CAST(fecha AS TEXT) LIKE $2', [idEmpleado, `${fecha}%`]);
}

function insertTurno(idEmpleado, fecha, horaInicio, horaFin, idUsuario) {
  return query(
    'INSERT INTO horario_turnos (id_empleado, fecha, hora_inicio, hora_fin, usuario_modificacion, fecha_actualizacion) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
    [idEmpleado, fecha, horaInicio, horaFin, idUsuario]
  );
}

async function markEnviado(idTienda, mes, idUsuario, periodo) {
  if (periodo.id_periodo) {
    return query(
      "UPDATE horario_periodos SET estado = 'ENVIADO', fecha_envio = CURRENT_TIMESTAMP, usuario_envio = $1 WHERE id_periodo = $2",
      [idUsuario, periodo.id_periodo]
    );
  }
  return query(
    "INSERT INTO horario_periodos (id_tienda, mes, estado, fecha_envio, usuario_envio) VALUES ($1, $2, 'ENVIADO', CURRENT_TIMESTAMP, $3)",
    [idTienda, mes, idUsuario]
  );
}

function reabrirPeriodo(idTienda, mes) {
  return query("UPDATE horario_periodos SET estado = 'BORRADOR' WHERE id_tienda = $1 AND mes = $2", [idTienda, mes]);
}

function insertSolicitud(idTienda, mes, motivo, idUsuario) {
  return query(
    "INSERT INTO horario_solicitudes (id_tienda, mes, motivo, estado, solicitado_por) VALUES ($1, $2, $3, 'PENDIENTE', $4)",
    [idTienda, mes, motivo, idUsuario]
  );
}

function findSolicitudesConJoins({ idTienda, estado }) {
  let sql = `
    SELECT
      s.id_solicitud, s.id_tienda, s.mes, s.motivo, s.estado,
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
  getPeriodo,
  getSolicitudPendiente,
  findTurnosForEmpleados,
  deleteTurnosForDia,
  insertTurno,
  markEnviado,
  reabrirPeriodo,
  insertSolicitud,
  findSolicitudesConJoins,
  findSolicitudById,
  resolverSolicitud
};
