const { query } = require('../config/db');

function findRecordsForEmpleados(mes, empIds) {
  const placeholders = empIds.map((_, i) => `$${i + 2}`).join(',');
  const sql = `
    SELECT id_registro, id_empleado, CAST(fecha AS TEXT) AS fecha, valor
    FROM capacity_diario
    WHERE CAST(fecha AS TEXT) LIKE $1 AND id_empleado IN (${placeholders})
  `;
  return query(sql, [`${mes}%`, ...empIds]);
}

function upsertRecord(idEmpleado, fecha, valor, idUsuario, queryFn = query) {
  const sql = `
    INSERT INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion, fecha_actualizacion)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (id_empleado, fecha)
    DO UPDATE SET valor = EXCLUDED.valor, usuario_modificacion = EXCLUDED.usuario_modificacion, fecha_actualizacion = NOW()
  `;
  return queryFn(sql, [idEmpleado, fecha, valor, idUsuario]);
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
      e.situacion,
      e.id_tienda,
      t.codigo_almacen,
      t.nombre_tienda,
      c.valor,
      c.fecha_actualizacion
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

// Una fila por colaborador y mes: lo que necesita el área que calcula bonos,
// en vez de reconstruir la suma desde ~3.000 filas diarias.
function findResumenMensual(mes, idTienda) {
  const params = [`${mes}%`, `${mes}-01`];
  let sql = `
    SELECT
      e.id_empleado,
      e.dni,
      e.codigo_empleado,
      e.nombre_completo,
      e.puesto,
      e.regimen,
      e.situacion,
      t.id_tienda,
      t.codigo_almacen,
      t.nombre_tienda,
      COUNT(c.id_registro) AS dias_con_registro,
      COALESCE(SUM(CASE WHEN c.valor > 0 THEN 1 ELSE 0 END), 0) AS dias_trabajados,
      MAX(c.fecha_actualizacion) AS ultima_actualizacion
    FROM empleados e
    INNER JOIN tiendas t ON t.id_tienda = e.id_tienda
    LEFT JOIN capacity_diario c
      ON c.id_empleado = e.id_empleado AND CAST(c.fecha AS TEXT) LIKE $1
    WHERE (
      e.situacion IN ('ACTIVO', 'NO_COMISIONA')
      OR (e.situacion = 'INACTIVO' AND (e.fecha_baja IS NULL OR CAST(e.fecha_baja AS TEXT) >= $2))
    )
  `;

  if (idTienda) {
    params.push(idTienda);
    sql += ` AND e.id_tienda = $${params.length}`;
  }

  sql += `
    GROUP BY e.id_empleado, e.dni, e.codigo_empleado, e.nombre_completo, e.puesto,
             e.regimen, e.situacion, t.id_tienda, t.codigo_almacen, t.nombre_tienda
    ORDER BY t.nombre_tienda ASC, e.nombre_completo ASC
  `;

  return query(sql, params);
}

// Semanas ya confirmadas como oficiales, para que quien consume sepa si el
// mes está completo o todavía faltan semanas por aprobar. El rango arranca
// antes del día 1 porque la semana que cubre los primeros días del mes puede
// empezar en el mes anterior.
function findSemanasOficiales(desde, hasta, idTienda) {
  const params = [desde, hasta];
  let sql = `
    SELECT id_tienda, CAST(semana_inicio AS TEXT) AS semana_inicio
    FROM horario_semanas
    WHERE confirmado_por IS NOT NULL
      AND CAST(semana_inicio AS TEXT) BETWEEN $1 AND $2
  `;
  if (idTienda) {
    params.push(idTienda);
    sql += ` AND id_tienda = $${params.length}`;
  }
  return query(sql, params);
}

module.exports = { findRecordsForEmpleados, upsertRecord, findExportRows, findResumenMensual, findSemanasOficiales };
