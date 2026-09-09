const { query, dbDriver } = require('../config/db');

function findRecordsForEmpleados(mes, empIds) {
  const placeholders = empIds.map((_, i) => `$${i + 2}`).join(',');
  // Importante: el driver SQLite de query() convierte $N a '?' posicional según
  // el orden en que aparecen EN EL TEXTO (no por su número), así que $1 debe
  // aparecer primero en el SQL para que coincida con el primer elemento del
  // array de params (ver query() en src/config/db.js).
  const sql = `
    SELECT id_registro, id_empleado, CAST(fecha AS TEXT) AS fecha, valor
    FROM capacity_diario
    WHERE CAST(fecha AS TEXT) LIKE $1 AND id_empleado IN (${placeholders})
  `;
  return query(sql, [`${mes}%`, ...empIds]);
}

function deleteRecord(idEmpleado, fecha, queryFn = query) {
  return queryFn('DELETE FROM capacity_diario WHERE id_empleado = $1 AND CAST(fecha AS TEXT) LIKE $2', [idEmpleado, `${fecha}%`]);
}

function upsertRecord(idEmpleado, fecha, valor, idUsuario, queryFn = query) {
  if (dbDriver === 'pg') {
    const upsertPg = `
      INSERT INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion, fecha_actualizacion)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id_empleado, fecha)
      DO UPDATE SET valor = EXCLUDED.valor, usuario_modificacion = EXCLUDED.usuario_modificacion, fecha_actualizacion = NOW()
    `;
    return queryFn(upsertPg, [idEmpleado, fecha, valor, idUsuario]);
  }
  const upsertSqlite = `
    INSERT INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion, fecha_actualizacion)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (id_empleado, fecha)
    DO UPDATE SET valor = EXCLUDED.valor, usuario_modificacion = EXCLUDED.usuario_modificacion, fecha_actualizacion = CURRENT_TIMESTAMP
  `;
  return queryFn(upsertSqlite, [idEmpleado, fecha, valor, idUsuario]);
}

function findExportRows(mes, idTienda) {
  let sql = `
    SELECT
      CAST(c.fecha AS TEXT) AS fecha,
      e.dni,
      e.codigo_empleado,
      e.nombre_completo AS nombre_empleado,
      e.puesto,
      e.regimen,
      e.celular,
      e.correo_asesor,
      t.codigo_almacen,
      t.nombre_tienda,
      c.valor
    FROM capacity_diario c
    INNER JOIN empleados e ON c.id_empleado = e.id_empleado
    INNER JOIN tiendas t ON e.id_tienda = t.id_tienda
    WHERE CAST(c.fecha AS TEXT) LIKE $1
  `;
  const params = [`${mes}%`];

  if (idTienda) {
    sql += ` AND e.id_tienda = $2`;
    params.push(idTienda);
  }

  sql += ` ORDER BY t.nombre_tienda ASC, e.nombre_completo ASC, c.fecha ASC`;

  return query(sql, params);
}

module.exports = { findRecordsForEmpleados, deleteRecord, upsertRecord, findExportRows };
