const tiendasRepository = require('../repositories/tiendasRepository');
const empleadosRepository = require('../repositories/empleadosRepository');
const capacityRepository = require('../repositories/capacityRepository');
const { getDaysInMonth } = require('../utils/dates');
const { ROLES_ADMIN } = require('../middleware/roles');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

function resolveTiendaId(user, queryIdTienda) {
  let idTienda = user.id_tienda;
  if (ROLES_ADMIN.includes(user.rol)) {
    if (queryIdTienda) {
      idTienda = parseInt(queryIdTienda, 10);
    } else if (!idTienda) {
      idTienda = 1;
    }
  }
  if (!idTienda) {
    throw new AppError('Debes especificar el ID de tienda.', 400);
  }
  return idTienda;
}

async function getCapacityMatrix(user, mesInput, queryIdTienda) {
  let mes = mesInput;
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    mes = '2026-08';
  }
  const firstDayOfMonth = `${mes}-01`;

  const idTienda = resolveTiendaId(user, queryIdTienda);

  const tienda = await tiendasRepository.findById(idTienda);
  if (!tienda) {
    throw new AppError('Tienda no encontrada.', 404);
  }

  const empleados = await empleadosRepository.getActiveEmpleados(idTienda, firstDayOfMonth);

  if (empleados.length === 0) {
    return {
      tienda,
      mes,
      dias_mes: getDaysInMonth(mes),
      empleados: [],
      resumen: {
        total_empleados: 0,
        promedio_capacity: 0,
        asistencias_completas: 0,
        dias_trabajados: 0
      }
    };
  }

  const empIds = empleados.map(e => e.id_empleado);
  const capacityRecords = await capacityRepository.findRecordsForEmpleados(mes, empIds);

  const capacityMap = {};
  let totalValor = 0;
  let asistenciasCompletasCount = 0;
  let totalDiasConRegistro = 0;

  capacityRecords.forEach(rec => {
    if (!capacityMap[rec.id_empleado]) {
      capacityMap[rec.id_empleado] = {};
    }
    const val = parseFloat(rec.valor);
    const fechaKey = String(rec.fecha).substring(0, 10);
    capacityMap[rec.id_empleado][fechaKey] = val;

    totalValor += val;
    if (val === 1.0) asistenciasCompletasCount++;
    if (val > 0) totalDiasConRegistro++;
  });

  const daysInMonth = getDaysInMonth(mes);
  const empleadosConDias = empleados.map(emp => {
    const diasObj = {};
    daysInMonth.forEach(dayStr => {
      diasObj[dayStr] = capacityMap[emp.id_empleado]?.[dayStr] ?? null;
    });
    return { ...emp, dias: diasObj };
  });

  const totalPosible = empleados.filter(e => e.situacion === 'ACTIVO').length * daysInMonth.length;
  const promedioCapacity = totalPosible > 0 ? parseFloat(((totalValor / totalPosible) * 100).toFixed(1)) : 0;

  return {
    tienda,
    mes,
    dias_mes: daysInMonth,
    empleados: empleadosConDias,
    resumen: {
      total_empleados: empleados.length,
      promedio_capacity: promedioCapacity,
      asistencias_completas: asistenciasCompletasCount,
      dias_trabajados: totalDiasConRegistro
    }
  };
}

async function createEmpleado(user, body) {
  const { dni, nombre_completo, puesto, regimen, celular, correo_asesor, codigo_empleado, id_tienda } = body || {};

  if (!dni || !nombre_completo) {
    throw new AppError('Debes proporcionar al menos DNI y Nombre Completo.', 400);
  }

  let targetTiendaId = user.id_tienda;
  if (ROLES_ADMIN.includes(user.rol) && id_tienda) {
    targetTiendaId = parseInt(id_tienda, 10);
  }
  if (!targetTiendaId) {
    throw new AppError('ID de tienda inválido.', 400);
  }

  const existing = await empleadosRepository.findByDni(dni.trim());
  if (existing) {
    throw new AppError('Ya existe un colaborador registrado con este DNI.', 400);
  }

  await empleadosRepository.insert({
    dni: dni.trim(),
    codigo_empleado: codigo_empleado && codigo_empleado.trim() !== '' ? codigo_empleado.trim() : null,
    nombre_completo: nombre_completo.trim(),
    puesto: puesto || 'ASESOR DE VENTAS',
    regimen: regimen || 'FT',
    celular: celular && celular.trim() !== '' ? celular.trim() : null,
    correo_asesor: correo_asesor && correo_asesor.trim() !== '' ? correo_asesor.trim() : null,
    id_tienda: targetTiendaId
  });

  return { message: 'Colaborador registrado exitosamente.' };
}

async function updateEmpleado(user, idEmpleado, body) {
  const { dni, nombre_completo, puesto, regimen, celular, correo_asesor, codigo_empleado, situacion, fecha_baja } = body || {};

  const emp = await empleadosRepository.findById(idEmpleado);
  if (!emp) {
    throw new AppError('Colaborador no encontrado.', 404);
  }

  if (user.rol === 'TIENDA' && emp.id_tienda !== user.id_tienda) {
    throw new AppError('Acceso denegado: Intento no autorizado de editar colaborador de otra sede.', 403);
  }

  const cleanFechaBaja = situacion === 'INACTIVO' ? (fecha_baja || new Date().toISOString().substring(0, 10)) : null;

  await empleadosRepository.update(idEmpleado, {
    dni: dni ? dni.trim() : null,
    nombre_completo: nombre_completo ? nombre_completo.trim() : null,
    puesto: puesto || null,
    regimen: regimen || null,
    celular: celular && celular.trim() !== '' ? celular.trim() : null,
    correo_asesor: correo_asesor && correo_asesor.trim() !== '' ? correo_asesor.trim() : null,
    codigo_empleado: codigo_empleado && codigo_empleado.trim() !== '' ? codigo_empleado.trim() : null,
    situacion: situacion || null,
    fecha_baja: cleanFechaBaja
  });

  return { message: 'Datos del colaborador actualizados exitosamente.' };
}

async function bulkUpdateCapacity(user, body) {
  let cambios = body;
  if (cambios && cambios.cambios) cambios = cambios.cambios;

  if (!Array.isArray(cambios) || cambios.length === 0) {
    throw new AppError('Formato de cambios inválido. Se espera un array de registros.', 400);
  }

  if (user.rol === 'TIENDA') {
    const empIdsToUpdate = [...new Set(cambios.map(c => c.id_empleado))];
    const checkedEmps = await empleadosRepository.findByIds(empIdsToUpdate);
    const invalidEmp = checkedEmps.find(e => e.id_tienda !== user.id_tienda);
    if (invalidEmp || checkedEmps.length !== empIdsToUpdate.length) {
      throw new AppError('Acceso denegado: Intento no autorizado de editar empleados de otra sede.', 403);
    }
  }

  let updatedCount = 0;
  await withTransaction(async (txQuery) => {
    for (const cambio of cambios) {
      const { id_empleado, fecha, valor } = cambio;
      if (!id_empleado || !fecha || valor === undefined) continue;

      if (valor === null) {
        await capacityRepository.deleteRecord(id_empleado, fecha, txQuery);
        updatedCount++;
        continue;
      }

      await capacityRepository.upsertRecord(id_empleado, fecha, parseFloat(valor), user.id_usuario, txQuery);
      updatedCount++;
    }
  });

  return { message: 'Registros de capacity actualizados correctamente.', registros_actualizados: updatedCount };
}

async function exportCapacity(mesInput, idTiendaInput) {
  const mes = mesInput || '2026-08';
  const idTienda = idTiendaInput ? parseInt(idTiendaInput, 10) : null;

  const rows = await capacityRepository.findExportRows(mes, idTienda);

  return rows.map(r => ({
    fecha: String(r.fecha).substring(0, 10),
    dni: r.dni,
    codigo_empleado: r.codigo_empleado || 'EN PRUEBA',
    nombre_empleado: r.nombre_empleado,
    puesto: r.puesto,
    regimen: r.regimen,
    celular: r.celular || '',
    correo_asesor: r.correo_asesor || '',
    codigo_almacen: r.codigo_almacen,
    nombre_tienda: r.nombre_tienda,
    valor: parseFloat(r.valor)
  }));
}

module.exports = {
  resolveTiendaId,
  getCapacityMatrix,
  createEmpleado,
  updateEmpleado,
  bulkUpdateCapacity,
  exportCapacity
};
