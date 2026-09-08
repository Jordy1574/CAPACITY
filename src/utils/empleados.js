const { query } = require('../config/db');

// Empleados ACTIVOS + empleados INACTIVOS cuya fecha_baja sea en el mes actual o posterior
// (gestión de alta rotación: no desaparecen de meses donde sí trabajaron).
async function getActiveEmpleados(idTienda, firstDayOfMonth) {
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

module.exports = { getActiveEmpleados };
