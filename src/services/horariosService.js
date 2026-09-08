const tiendasRepository = require('../repositories/tiendasRepository');
const empleadosRepository = require('../repositories/empleadosRepository');
const horariosRepository = require('../repositories/horariosRepository');
const { getDaysInMonth } = require('../utils/dates');
const { ROLES_ADMIN } = require('../middleware/roles');
const AppError = require('../errors/AppError');

// Usada en lecturas (GET /api/horarios): admins pueden omitir id_tienda, se asume tienda 1 por defecto.
function resolveTiendaIdForRead(user, queryIdTienda) {
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

// Usada en acciones (enviar / solicitar-permiso): admins DEBEN especificar id_tienda explícitamente.
function resolveTiendaIdRequired(user, bodyIdTienda) {
  let idTienda = user.id_tienda;
  if (ROLES_ADMIN.includes(user.rol)) {
    if (!bodyIdTienda) {
      throw new AppError('Debes especificar el ID de tienda.', 400);
    }
    idTienda = parseInt(bodyIdTienda, 10);
  }
  return idTienda;
}

async function getHorarioMatrix(user, mesInput, queryIdTienda) {
  let mes = mesInput;
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    mes = '2026-09';
  }
  const firstDayOfMonth = `${mes}-01`;

  const idTienda = resolveTiendaIdForRead(user, queryIdTienda);

  const tienda = await tiendasRepository.findById(idTienda);
  if (!tienda) {
    throw new AppError('Tienda no encontrada.', 404);
  }

  const empleados = await empleadosRepository.getActiveEmpleados(idTienda, firstDayOfMonth);
  const daysInMonth = getDaysInMonth(mes);
  const periodo = await horariosRepository.getPeriodo(idTienda, mes);
  const solicitudPendiente = await horariosRepository.getSolicitudPendiente(idTienda, mes);

  if (empleados.length === 0) {
    return {
      tienda,
      mes,
      dias_mes: daysInMonth,
      empleados: [],
      periodo,
      solicitud_pendiente: solicitudPendiente
    };
  }

  const empIds = empleados.map(e => e.id_empleado);
  const turnoRecords = await horariosRepository.findTurnosForEmpleados(mes, empIds);

  const turnosMap = {};
  turnoRecords.forEach(rec => {
    if (!turnosMap[rec.id_empleado]) turnosMap[rec.id_empleado] = {};
    const fecha = String(rec.fecha).substring(0, 10);
    if (!turnosMap[rec.id_empleado][fecha]) turnosMap[rec.id_empleado][fecha] = [];
    turnosMap[rec.id_empleado][fecha].push({ hora_inicio: rec.hora_inicio, hora_fin: rec.hora_fin });
  });

  const empleadosConDias = empleados.map(emp => {
    const diasObj = {};
    daysInMonth.forEach(dayStr => {
      diasObj[dayStr] = turnosMap[emp.id_empleado]?.[dayStr] ?? [];
    });
    return { ...emp, dias: diasObj };
  });

  return {
    tienda,
    mes,
    dias_mes: daysInMonth,
    empleados: empleadosConDias,
    periodo,
    solicitud_pendiente: solicitudPendiente
  };
}

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function horaToMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// Valida formato, orden y solapes de los bloques de turno de un día,
// y los devuelve ordenados por hora de inicio listos para guardar.
function validarBloquesTurno(turnos) {
  const bloques = turnos.map(t => {
    if (!t || !HORA_REGEX.test(t.hora_inicio) || !HORA_REGEX.test(t.hora_fin)) {
      throw new AppError('Formato de hora inválido. Usa HH:MM.', 400);
    }
    const inicio = horaToMinutos(t.hora_inicio);
    const fin = horaToMinutos(t.hora_fin);
    if (fin <= inicio) {
      throw new AppError('La hora de fin debe ser posterior a la hora de inicio.', 400);
    }
    return { hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, inicio, fin };
  });

  bloques.sort((a, b) => a.inicio - b.inicio);
  for (let i = 1; i < bloques.length; i++) {
    if (bloques[i].inicio < bloques[i - 1].fin) {
      throw new AppError('Los bloques de turno no pueden solaparse.', 400);
    }
  }
  return bloques;
}

async function bulkUpdateHorario(user, body) {
  let cambios = body;
  if (cambios && cambios.cambios) cambios = cambios.cambios;

  if (!Array.isArray(cambios) || cambios.length === 0) {
    throw new AppError('Formato de cambios inválido. Se espera un array de registros.', 400);
  }

  const empIdsToUpdate = [...new Set(cambios.map(c => c.id_empleado))];
  const checkedEmps = await empleadosRepository.findByIds(empIdsToUpdate);

  if (user.rol === 'TIENDA') {
    const invalidEmp = checkedEmps.find(e => e.id_tienda !== user.id_tienda);
    if (invalidEmp || checkedEmps.length !== empIdsToUpdate.length) {
      throw new AppError('Acceso denegado: Intento no autorizado de editar empleados de otra sede.', 403);
    }

    // El horario enviado se bloquea para TIENDA hasta que se otorgue permiso de modificación.
    const mesesTienda = [...new Set(cambios.map(c => String(c.fecha).substring(0, 7)))];
    for (const mes of mesesTienda) {
      const periodo = await horariosRepository.getPeriodo(user.id_tienda, mes);
      if (periodo.estado === 'ENVIADO') {
        throw new AppError(`El horario de ${mes} ya fue enviado. Solicita permiso a Supervisor/RRHH/Admin para poder modificarlo.`, 403);
      }
    }
  }

  let updatedCount = 0;
  for (const cambio of cambios) {
    const { id_empleado, fecha, turnos } = cambio;
    if (!id_empleado || !fecha || !Array.isArray(turnos)) continue;

    const bloques = validarBloquesTurno(turnos);

    await horariosRepository.deleteTurnosForDia(id_empleado, fecha);
    for (const bloque of bloques) {
      await horariosRepository.insertTurno(id_empleado, fecha, bloque.hora_inicio, bloque.hora_fin, user.id_usuario);
    }
    updatedCount++;
  }

  return { message: 'Horario actualizado correctamente.', registros_actualizados: updatedCount };
}

async function enviarHorario(user, mes, bodyIdTienda) {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    throw new AppError('Debes indicar un mes válido (YYYY-MM).', 400);
  }

  const idTienda = resolveTiendaIdRequired(user, bodyIdTienda);
  const periodo = await horariosRepository.getPeriodo(idTienda, mes);

  if (user.rol === 'TIENDA' && periodo.estado === 'ENVIADO') {
    throw new AppError('El horario ya fue enviado. Solicita permiso si necesitas modificarlo.', 400);
  }

  await horariosRepository.markEnviado(idTienda, mes, user.id_usuario, periodo);

  return { message: 'Horario enviado correctamente. Ya no se puede editar salvo que se otorgue permiso.' };
}

async function solicitarPermiso(user, mes, motivo, bodyIdTienda) {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    throw new AppError('Debes indicar un mes válido (YYYY-MM).', 400);
  }
  if (!motivo || !motivo.trim()) {
    throw new AppError('Debes indicar el motivo de la solicitud.', 400);
  }

  const idTienda = resolveTiendaIdRequired(user, bodyIdTienda);
  const periodo = await horariosRepository.getPeriodo(idTienda, mes);

  if (periodo.estado !== 'ENVIADO') {
    throw new AppError('Este horario no está enviado, no requiere permiso para modificarse.', 400);
  }

  const existente = await horariosRepository.getSolicitudPendiente(idTienda, mes);
  if (existente) {
    throw new AppError('Ya existe una solicitud pendiente para este periodo.', 400);
  }

  await horariosRepository.insertSolicitud(idTienda, mes, motivo.trim(), user.id_usuario);

  return { message: 'Solicitud de permiso enviada. Se te notificará cuando sea revisada.' };
}

function listSolicitudes(user, query) {
  const idTienda = user.rol === 'TIENDA'
    ? user.id_tienda
    : (query.id_tienda ? parseInt(query.id_tienda, 10) : undefined);

  return horariosRepository.findSolicitudesConJoins({ idTienda, estado: query.estado });
}

async function resolverSolicitudService(user, idSolicitud, aprobar, comentario) {
  const solicitud = await horariosRepository.findSolicitudById(idSolicitud);
  if (!solicitud) {
    throw new AppError('Solicitud no encontrada.', 404);
  }
  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError('Esta solicitud ya fue resuelta anteriormente.', 400);
  }

  const nuevoEstado = aprobar ? 'APROBADA' : 'RECHAZADA';
  await horariosRepository.resolverSolicitud(idSolicitud, nuevoEstado, user.id_usuario, comentario || null);

  if (aprobar) {
    await horariosRepository.reabrirPeriodo(solicitud.id_tienda, solicitud.mes);
  }

  return {
    message: aprobar
      ? 'Solicitud aprobada. La tienda ya puede modificar su horario.'
      : 'Solicitud rechazada.'
  };
}

const DIAS_DESCANSO_VALIDOS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

async function updateDiaDescanso(user, idEmpleado, diaDescanso) {
  const emp = await empleadosRepository.findById(idEmpleado);
  if (!emp) {
    throw new AppError('Colaborador no encontrado.', 404);
  }
  if (user.rol === 'TIENDA' && emp.id_tienda !== user.id_tienda) {
    throw new AppError('Acceso denegado: Intento no autorizado de editar colaborador de otra sede.', 403);
  }

  const valor = diaDescanso ? String(diaDescanso).trim().toUpperCase() : null;
  if (valor && !DIAS_DESCANSO_VALIDOS.includes(valor)) {
    throw new AppError('Día de descanso inválido.', 400);
  }

  await empleadosRepository.updateDiaDescanso(idEmpleado, valor);
  return { message: 'Día de descanso actualizado.' };
}

module.exports = {
  getHorarioMatrix,
  bulkUpdateHorario,
  enviarHorario,
  solicitarPermiso,
  listSolicitudes,
  resolverSolicitudService,
  updateDiaDescanso
};
