const { query } = require('../config/db');

// Novedades que se solapan con un rango de fechas, para los empleados dados.
// Se compara por solape de rangos (no por contención) porque unas vacaciones
// pueden empezar antes de la semana consultada y terminar dentro de ella.
function findEnRango(empIds, desde, hasta) {
  if (!empIds || empIds.length === 0) return Promise.resolve([]);
  const empPlaceholders = empIds.map((_, i) => `$${i + 3}`).join(',');
  const sql = `
    SELECT id_novedad, id_empleado, tipo,
           CAST(fecha_inicio AS TEXT) AS fecha_inicio,
           CAST(fecha_fin AS TEXT) AS fecha_fin,
           con_goce, observacion, fecha_registro
    FROM empleado_novedades
    WHERE CAST(fecha_inicio AS TEXT) <= $1
      AND CAST(fecha_fin AS TEXT) >= $2
      AND id_empleado IN (${empPlaceholders})
    ORDER BY fecha_inicio ASC
  `;
  return query(sql, [hasta, desde, ...empIds]);
}

function findByEmpleado(idEmpleado) {
  return query(
    `SELECT id_novedad, id_empleado, tipo,
            CAST(fecha_inicio AS TEXT) AS fecha_inicio,
            CAST(fecha_fin AS TEXT) AS fecha_fin,
            con_goce, observacion, fecha_registro
     FROM empleado_novedades
     WHERE id_empleado = $1
     ORDER BY fecha_inicio DESC`,
    [idEmpleado]
  );
}

async function findById(idNovedad) {
  const rows = await query('SELECT * FROM empleado_novedades WHERE id_novedad = $1', [idNovedad]);
  return rows[0] || null;
}

function insert({ idEmpleado, tipo, fechaInicio, fechaFin, conGoce, observacion, registradoPor }) {
  return query(
    `INSERT INTO empleado_novedades (id_empleado, tipo, fecha_inicio, fecha_fin, con_goce, observacion, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_novedad`,
    [idEmpleado, tipo, fechaInicio, fechaFin, conGoce ? 1 : 0, observacion || null, registradoPor || null]
  );
}

function remove(idNovedad) {
  return query('DELETE FROM empleado_novedades WHERE id_novedad = $1', [idNovedad]);
}

module.exports = { findEnRango, findByEmpleado, findById, insert, remove };
