const { query } = require('../config/db');

// Empleados ACTIVOS + empleados INACTIVOS cuya fecha_baja sea en el mes actual o posterior
// (gestión de alta rotación: no desaparecen de meses donde sí trabajaron).
// finDelPeriodo: ultimo dia del mes o de la semana consultada. Se usa para
// ocultar a quien ingreso despues de ese periodo.
function getActiveEmpleados(idTienda, firstDayOfMonth, queryFn = query, finDelPeriodo = '9999-12-31') {
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
      horas_semana,
      CAST(fecha_ingreso AS TEXT) AS fecha_ingreso,
      id_tienda
    FROM empleados
    WHERE id_tienda = $1
      AND (
        situacion IN ('ACTIVO', 'NO_COMISIONA')
        OR (situacion = 'INACTIVO' AND (fecha_baja IS NULL OR CAST(fecha_baja AS TEXT) >= $2))
      )
      -- No aparece en periodos anteriores a su ingreso. Sin fecha cargada se
      -- asume que ya estaba (los colaboradores historicos no la tienen).
      AND (fecha_ingreso IS NULL OR CAST(fecha_ingreso AS TEXT) <= $3)
    ORDER BY
      CASE WHEN situacion <> 'INACTIVO' THEN 1 ELSE 2 END ASC,
      CASE WHEN codigo_empleado IS NULL THEN 1 ELSE 0 END ASC,
      codigo_empleado ASC,
      nombre_completo ASC
  `;
  return queryFn(sql, [idTienda, firstDayOfMonth, finDelPeriodo]);
}

async function findById(idEmpleado) {
  const rows = await query('SELECT id_empleado, id_tienda, nombre_completo, dni, codigo_empleado FROM empleados WHERE id_empleado = $1', [idEmpleado]);
  return rows[0] || null;
}

// Mueve la ficha completa a otra sede. Se usa al cambiar de área a una cuenta
// personal (Oficina <-> Logística): la persona y su historial son los mismos,
// solo cambia dónde trabaja.
function moverDeTienda(idEmpleado, idTienda, queryFn = query) {
  return queryFn('UPDATE empleados SET id_tienda = $1 WHERE id_empleado = $2', [idTienda, idEmpleado]);
}

// ¿La ficha tiene algo que perder? Se consulta antes de borrarla junto con su
// cuenta: sin horarios ni capacity es un registro de prueba, con ellos es
// historial que hay que conservar.
async function tieneHistorial(idEmpleado) {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM capacity_diario WHERE id_empleado = $1)
     + (SELECT COUNT(*) FROM horario_turnos WHERE id_empleado = $1)
     + (SELECT COUNT(*) FROM empleado_novedades WHERE id_empleado = $1) AS total`,
    [idEmpleado]
  );
  return Number(rows[0]?.total || 0) > 0;
}

function deleteById(idEmpleado, queryFn = query) {
  return queryFn('DELETE FROM empleados WHERE id_empleado = $1', [idEmpleado]);
}

// Todas las fichas de una persona: puede estar en varias sedes por apoyo.
function findAllByDni(dni) {
  return query(
    `SELECT e.id_empleado, e.dni, e.nombre_completo, e.celular, e.correo_asesor, e.regimen,
            e.puesto, e.codigo_empleado, e.situacion, e.id_tienda, t.nombre_tienda
     FROM empleados e
     INNER JOIN tiendas t ON t.id_tienda = e.id_tienda
     WHERE e.dni = $1
     ORDER BY t.nombre_tienda`,
    [dni]
  );
}

async function findByCodigoEnTienda(idTienda, codigo) {
  const rows = await query(
    'SELECT id_empleado, nombre_completo FROM empleados WHERE id_tienda = $1 AND codigo_empleado = $2',
    [idTienda, codigo]
  );
  return rows[0] || null;
}

function darDeBaja(idEmpleado, fechaBaja, queryFn = query) {
  return queryFn(
    "UPDATE empleados SET situacion = 'INACTIVO', fecha_baja = $1 WHERE id_empleado = $2",
    [fechaBaja, idEmpleado]
  );
}

// Solo los campos de la persona: no toca codigo, estado ni jornada, que son
// propios de cada sede.
function updateDatosPersonales(idEmpleado, datos, queryFn = query) {
  return queryFn(
    `UPDATE empleados
     SET nombre_completo = COALESCE($1, nombre_completo),
         celular = $2,
         correo_asesor = $3,
         regimen = COALESCE($4, regimen)
     WHERE id_empleado = $5`,
    [datos.nombre_completo, datos.celular, datos.correo_asesor, datos.regimen, idEmpleado]
  );
}

function findByIds(idArray, queryFn = query) {
  const placeholders = idArray.map((_, i) => `$${i + 1}`).join(',');
  return queryFn(`SELECT id_empleado, id_tienda, dia_descanso FROM empleados WHERE id_empleado IN (${placeholders})`, idArray);
}

function insert(data, queryFn = query) {
  const insertSql = `
    INSERT INTO empleados (dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion, fecha_ingreso)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVO', $9)
    RETURNING id_empleado
  `;
  return queryFn(insertSql, [
    data.dni,
    data.codigo_empleado,
    data.nombre_completo,
    data.puesto,
    data.regimen,
    data.celular,
    data.correo_asesor,
    data.id_tienda,
    data.fecha_ingreso || null
  ]);
}

function update(idEmpleado, data, queryFn = query) {
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
        fecha_baja = $9,
        horas_semana = $10,
        fecha_ingreso = $11
    WHERE id_empleado = $12
  `;
  return queryFn(updateSql, [
    data.dni,
    data.nombre_completo,
    data.puesto,
    data.regimen,
    data.celular,
    data.correo_asesor,
    data.codigo_empleado,
    data.situacion,
    data.fecha_baja,
    data.horas_semana,
    data.fecha_ingreso || null,
    idEmpleado
  ]);
}

function updateDiaDescanso(idEmpleado, diaDescanso, queryFn = query) {
  return queryFn('UPDATE empleados SET dia_descanso = $1 WHERE id_empleado = $2', [diaDescanso, idEmpleado]);
}

module.exports = {
  getActiveEmpleados, findById, findAllByDni, findByCodigoEnTienda,
  findByIds, insert, update, updateDatosPersonales, darDeBaja, updateDiaDescanso,
  moverDeTienda, tieneHistorial, deleteById
};
