const { query } = require('../config/db');

// Empleados ACTIVOS + empleados INACTIVOS cuya fecha_baja sea en el mes actual o posterior
// (gestión de alta rotación: no desaparecen de meses donde sí trabajaron).
function getActiveEmpleados(idTienda, firstDayOfMonth) {
  const sql = `
    SELECT
      id_empleado,
      dni,
      codigo_empleado,
      nombre_completo,
      puesto,
      regimen,
      celular,
      correo_asesor,
      situacion,
      CAST(fecha_baja AS TEXT) AS fecha_baja,
      dia_descanso,
      id_tienda
    FROM empleados
    WHERE id_tienda = $1
      AND (
        situacion = 'ACTIVO'
        OR (situacion = 'INACTIVO' AND (fecha_baja IS NULL OR CAST(fecha_baja AS TEXT) >= $2))
      )
    ORDER BY
      CASE WHEN situacion = 'ACTIVO' THEN 1 ELSE 2 END ASC,
      CASE WHEN codigo_empleado IS NULL THEN 1 ELSE 0 END ASC,
      codigo_empleado ASC,
      nombre_completo ASC
  `;
  return query(sql, [idTienda, firstDayOfMonth]);
}

async function findById(idEmpleado) {
  const rows = await query('SELECT id_empleado, id_tienda FROM empleados WHERE id_empleado = $1', [idEmpleado]);
  return rows[0] || null;
}

async function findByDni(dni) {
  const rows = await query('SELECT id_empleado FROM empleados WHERE dni = $1', [dni]);
  return rows[0] || null;
}

function findByIds(idArray) {
  const placeholders = idArray.map((_, i) => `$${i + 1}`).join(',');
  return query(`SELECT id_empleado, id_tienda FROM empleados WHERE id_empleado IN (${placeholders})`, idArray);
}

function insert(data) {
  const insertSql = `
    INSERT INTO empleados (dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVO')
  `;
  return query(insertSql, [
    data.dni,
    data.codigo_empleado,
    data.nombre_completo,
    data.puesto,
    data.regimen,
    data.celular,
    data.correo_asesor,
    data.id_tienda
  ]);
}

function update(idEmpleado, data) {
  const updateSql = `
    UPDATE empleados
    SET dni = COALESCE($1, dni),
        nombre_completo = COALESCE($2, nombre_completo),
        puesto = COALESCE($3, puesto),
        regimen = COALESCE($4, regimen),
        celular = $5,
        correo_asesor = $6,
        codigo_empleado = $7,
        situacion = COALESCE($8, situacion),
        fecha_baja = $9
    WHERE id_empleado = $10
  `;
  return query(updateSql, [
    data.dni,
    data.nombre_completo,
    data.puesto,
    data.regimen,
    data.celular,
    data.correo_asesor,
    data.codigo_empleado,
    data.situacion,
    data.fecha_baja,
    idEmpleado
  ]);
}

function updateDiaDescanso(idEmpleado, diaDescanso) {
  return query('UPDATE empleados SET dia_descanso = $1 WHERE id_empleado = $2', [diaDescanso, idEmpleado]);
}

module.exports = { getActiveEmpleados, findById, findByDni, findByIds, insert, update, updateDiaDescanso };
