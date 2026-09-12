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

function findTurnosForFechas(fechas, empIds, queryFn = query) {
  const fechaPlaceholders = fechas.map((_, i) => `$${i + 1}`).join(',');
  const empPlaceholders = empIds.map((_, i) => `$${fechas.length + i + 1}`).join(',');
  const sql = `
    SELECT id_turno, id_empleado, CAST(fecha AS TEXT) AS fecha, hora_inicio, hora_fin
    FROM horario_turnos
    WHERE CAST(fecha AS TEXT) IN (${fechaPlaceholders}) AND id_empleado IN (${empPlaceholders})
    ORDER BY hora_inicio ASC
  `;
  return queryFn(sql, [...fechas, ...empIds]);
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

// Borra la pendiente de esa tienda+semana, si la hay. El filtro por estado va
// dentro del propio DELETE: si un admin acaba de aprobarla, ya no es pendiente
// y no se toca, para no borrar el registro de una aprobación. Los turnos y
// días de detalle caen por ON DELETE CASCADE.
function eliminarSolicitudPendiente(idTienda, semanaInicio, queryFn = query) {
  return queryFn(
    "DELETE FROM horario_solicitudes WHERE id_tienda = $1 AND semana_inicio = $2 AND estado = 'PENDIENTE'",
    [idTienda, semanaInicio]
  );
}

// Reemplaza la solicitud pendiente por una nueva, todo en una transacción para
// que nunca queden dos pendientes de la misma semana ni se pierda la anterior
// sin haber creado la nueva.
async function crearSolicitud(idTienda, semanaInicio, motivo, idUsuario, cambios, queryFn = query) {
  await eliminarSolicitudPendiente(idTienda, semanaInicio, queryFn);

  const rows = await queryFn(
    "INSERT INTO horario_solicitudes (id_tienda, semana_inicio, motivo, estado, solicitado_por) VALUES ($1, $2, $3, 'PENDIENTE', $4) RETURNING id_solicitud",
    [idTienda, semanaInicio, motivo, idUsuario]
  );
  const idSolicitud = rows[0].id_solicitud;

  for (const cambio of cambios) {
    await queryFn('INSERT INTO horario_solicitud_dias (id_solicitud, id_empleado, fecha) VALUES ($1, $2, $3)', [idSolicitud, cambio.id_empleado, cambio.fecha]);
    for (const bloque of cambio.turnos) {
      await queryFn(
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
      s.fecha_solicitud, s.fecha_resolucion, s.comentario_resolucion, s.version,
      t.nombre_tienda, t.codigo_almacen,
      COALESCE(us.email, us.username) AS solicitado_por_email,
      COALESCE(ur.email, ur.username) AS resuelto_por_email
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

// La condición "estado = 'PENDIENTE'" dentro del propio UPDATE es lo que
// evita la carrera: si otro ya la resolvió (o la tienda la reemplazó), no
// coincide ninguna fila y devuelve vacío en vez de pisar el resultado.
// Devuelve las filas afectadas: 1 = ganó esta operación, 0 = alguien se adelantó.
function resolverSolicitud(id, nuevoEstado, idUsuario, comentario, versionEsperada, queryFn = query) {
  // La versión evita aprobar contenido viejo: si la tienda corrigió la
  // solicitud mientras el admin la revisaba, la versión subió y el UPDATE no
  // coincide, así que la aprobación se rechaza en vez de aplicar lo anterior.
  const filtraVersion = versionEsperada !== undefined && versionEsperada !== null;
  return queryFn(
    `UPDATE horario_solicitudes
     SET estado = $1, resuelto_por = $2, fecha_resolucion = CURRENT_TIMESTAMP, comentario_resolucion = $3
     WHERE id_solicitud = $4 AND estado = 'PENDIENTE'${filtraVersion ? ' AND version = $5' : ''}
     RETURNING id_solicitud`,
    filtraVersion ? [nuevoEstado, idUsuario, comentario, id, versionEsperada] : [nuevoEstado, idUsuario, comentario, id]
  );
}

// Reemplaza el contenido de una solicitud que sigue pendiente. Mismo criterio:
// el UPDATE solo entra si nadie la resolvió todavía.
async function actualizarSolicitudPendiente(idSolicitud, motivo, cambios, queryFn = query) {
  const filas = await queryFn(
    `UPDATE horario_solicitudes
     SET motivo = $1, fecha_solicitud = CURRENT_TIMESTAMP, version = version + 1
     WHERE id_solicitud = $2 AND estado = 'PENDIENTE'
     RETURNING id_solicitud, version`,
    [motivo, idSolicitud]
  );
  if (filas.length === 0) return false;

  await queryFn('DELETE FROM horario_solicitud_turnos WHERE id_solicitud = $1', [idSolicitud]);
  await queryFn('DELETE FROM horario_solicitud_dias WHERE id_solicitud = $1', [idSolicitud]);

  for (const cambio of cambios) {
    await queryFn('INSERT INTO horario_solicitud_dias (id_solicitud, id_empleado, fecha) VALUES ($1, $2, $3)', [idSolicitud, cambio.id_empleado, cambio.fecha]);
    for (const bloque of cambio.turnos) {
      await queryFn(
        'INSERT INTO horario_solicitud_turnos (id_solicitud, id_empleado, fecha, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4, $5)',
        [idSolicitud, cambio.id_empleado, cambio.fecha, bloque.hora_inicio, bloque.hora_fin]
      );
    }
  }
  return true;
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
  eliminarSolicitudPendiente,
  findSolicitudesConJoins,
  findSolicitudById,
  resolverSolicitud,
  actualizarSolicitudPendiente
};
