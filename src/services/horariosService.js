const tiendasRepository = require('../repositories/tiendasRepository');
const empleadosRepository = require('../repositories/empleadosRepository');
const horariosRepository = require('../repositories/horariosRepository');
const { getMondayOf, getWeekDates, todayStr } = require('../utils/dates');
const { ROLES_ADMIN } = require('../middleware/roles');
const AppError = require('../errors/AppError');

// Usada en lecturas (GET /api/horarios/semana): admins pueden omitir id_tienda, se asume tienda 1 por defecto.
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

// Usada en acciones (crear/resolver solicitud): admins DEBEN especificar id_tienda explícitamente.
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

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizarSemanaInicio(semanaInput) {
  const base = FECHA_REGEX.test(semanaInput) ? semanaInput : todayStr();
  return getMondayOf(base);
}

async function getHorarioSemana(user, semanaInicioInput, queryIdTienda) {
  const semanaInicio = normalizarSemanaInicio(semanaInicioInput);
  const weekDates = getWeekDates(semanaInicio);
  const idTienda = resolveTiendaIdForRead(user, queryIdTienda);

  const tienda = await tiendasRepository.findById(idTienda);
  if (!tienda) {
    throw new AppError('Tienda no encontrada.', 404);
  }

  const empleados = await empleadosRepository.getActiveEmpleados(idTienda, semanaInicio);
  const periodo = await horariosRepository.getSemana(idTienda, semanaInicio);
  const solicitudPendiente = await horariosRepository.getSolicitudPendiente(idTienda, semanaInicio);

  const cambiosMap = {};
  let solicitudCambios = [];
  if (solicitudPendiente) {
    solicitudCambios = await horariosRepository.getCambiosDeSolicitud(solicitudPendiente.id_solicitud);
    solicitudCambios.forEach(c => {
      if (!cambiosMap[c.id_empleado]) cambiosMap[c.id_empleado] = {};
      cambiosMap[c.id_empleado][c.fecha] = c.turnos;
    });
  }

  const solicitudInfo = solicitudPendiente
    ? {
        id_solicitud: solicitudPendiente.id_solicitud,
        motivo: solicitudPendiente.motivo,
        fecha_solicitud: solicitudPendiente.fecha_solicitud,
        solicitado_por_email: solicitudPendiente.solicitado_por_email,
        cambios: solicitudCambios
      }
    : null;

  if (empleados.length === 0) {
    return { tienda, semana_inicio: semanaInicio, dias_semana: weekDates, empleados: [], periodo, solicitud_pendiente: solicitudInfo };
  }

  const empIds = empleados.map(e => e.id_empleado);
  const turnoRecords = await horariosRepository.findTurnosForFechas(weekDates, empIds);

  const turnosMap = {};
  turnoRecords.forEach(rec => {
    if (!turnosMap[rec.id_empleado]) turnosMap[rec.id_empleado] = {};
    if (!turnosMap[rec.id_empleado][rec.fecha]) turnosMap[rec.id_empleado][rec.fecha] = [];
    turnosMap[rec.id_empleado][rec.fecha].push({ hora_inicio: rec.hora_inicio, hora_fin: rec.hora_fin });
  });

  const empleadosConDias = empleados.map(emp => {
    const diasObj = {};
    weekDates.forEach(fecha => {
      const propuesto = cambiosMap[emp.id_empleado]?.[fecha];
      diasObj[fecha] = propuesto !== undefined ? propuesto : (turnosMap[emp.id_empleado]?.[fecha] ?? []);
    });
    return { ...emp, dias: diasObj };
  });

  return { tienda, semana_inicio: semanaInicio, dias_semana: weekDates, empleados: empleadosConDias, periodo, solicitud_pendiente: solicitudInfo };
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

async function verificarEmpleadosDeTienda(empIds, idTienda) {
  const checkedEmps = await empleadosRepository.findByIds(empIds);
  const invalidEmp = checkedEmps.find(e => e.id_tienda !== idTienda);
  if (invalidEmp || checkedEmps.length !== empIds.length) {
    throw new AppError('Acceso denegado: Intento no autorizado de editar empleados de otra sede.', 403);
  }
}

async function bulkUpdateHorario(user, body) {
  let cambios = body;
  if (cambios && cambios.cambios) cambios = cambios.cambios;

  if (!Array.isArray(cambios) || cambios.length === 0) {
    throw new AppError('Formato de cambios inválido. Se espera un array de registros.', 400);
  }

  const empIdsToUpdate = [...new Set(cambios.map(c => c.id_empleado))];

  if (user.rol === 'TIENDA') {
    await verificarEmpleadosDeTienda(empIdsToUpdate, user.id_tienda);

    // Mientras la semana no tenga horario oficial confirmado, la tienda edita
    // libre en vivo. Una vez confirmado, debe pasar por una solicitud de cambio.
    const semanasTocadas = [...new Set(cambios.map(c => getMondayOf(String(c.fecha).substring(0, 10))))];
    for (const semanaInicio of semanasTocadas) {
      const periodo = await horariosRepository.getSemana(user.id_tienda, semanaInicio);
      if (periodo.confirmado_por) {
        throw new AppError(`El horario de la semana del ${semanaInicio} ya fue confirmado como oficial. Debes enviar una solicitud de cambio.`, 403);
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

function formatFechaCorta(fecha) {
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
}

function autoMotivo(semanaInicio, weekDates) {
  return `Horario propuesto: semana del ${formatFechaCorta(semanaInicio)} al ${formatFechaCorta(weekDates[6])}.`;
}

// Crea (o reemplaza, si ya había una PENDIENTE) la solicitud de cambio de
// horario para una tienda+semana. Si la semana aún no tiene horario oficial,
// el motivo se autogenera y se toma una foto de los turnos ya guardados en
// vivo; si ya es oficial, se exige motivo y los turnos vienen del cliente
// (nunca tocan la tabla en vivo hasta que se apruebe).
async function crearSolicitud(user, semanaInicioInput, bodyIdTienda, motivoInput, cambiosInput) {
  const semanaInicio = normalizarSemanaInicio(semanaInicioInput);
  const weekDates = getWeekDates(semanaInicio);
  const idTienda = resolveTiendaIdRequired(user, bodyIdTienda);

  if (semanaInicio < getMondayOf(todayStr())) {
    throw new AppError('No se pueden crear solicitudes para semanas pasadas.', 400);
  }

  const periodo = await horariosRepository.getSemana(idTienda, semanaInicio);
  let motivo;
  let cambios;

  if (periodo.confirmado_por) {
    motivo = (motivoInput || '').trim();
    if (!motivo) {
      throw new AppError('Debes indicar el motivo del cambio.', 400);
    }
    if (!Array.isArray(cambiosInput) || cambiosInput.length === 0) {
      throw new AppError('No hay cambios que enviar.', 400);
    }
    const empIds = [...new Set(cambiosInput.map(c => c.id_empleado))];
    await verificarEmpleadosDeTienda(empIds, idTienda);
    cambios = cambiosInput.map(c => ({
      id_empleado: c.id_empleado,
      fecha: c.fecha,
      turnos: validarBloquesTurno(c.turnos || [])
    }));
  } else {
    motivo = (motivoInput || '').trim() || autoMotivo(semanaInicio, weekDates);
    const empleados = await empleadosRepository.getActiveEmpleados(idTienda, semanaInicio);
    const empIds = empleados.map(e => e.id_empleado);
    const turnoRecords = empIds.length ? await horariosRepository.findTurnosForFechas(weekDates, empIds) : [];
    const agrupado = {};
    turnoRecords.forEach(rec => {
      const key = `${rec.id_empleado}_${rec.fecha}`;
      if (!agrupado[key]) agrupado[key] = { id_empleado: rec.id_empleado, fecha: rec.fecha, turnos: [] };
      agrupado[key].turnos.push({ hora_inicio: rec.hora_inicio, hora_fin: rec.hora_fin });
    });
    cambios = Object.values(agrupado);
  }

  await horariosRepository.crearSolicitud(idTienda, semanaInicio, motivo, user.id_usuario, cambios);

  return { message: 'Horario enviado para aprobación. Un Admin/Supervisor/RRHH debe confirmarlo para que quede oficial.' };
}

async function resolverSolicitudService(user, idSolicitud, aprobar, comentario, cambiosFinales) {
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
    const cambios = Array.isArray(cambiosFinales) && cambiosFinales.length > 0
      ? cambiosFinales
      : await horariosRepository.getCambiosDeSolicitud(idSolicitud);

    for (const cambio of cambios) {
      const bloques = validarBloquesTurno(cambio.turnos || []);
      await horariosRepository.deleteTurnosForDia(cambio.id_empleado, cambio.fecha);
      for (const bloque of bloques) {
        await horariosRepository.insertTurno(cambio.id_empleado, cambio.fecha, bloque.hora_inicio, bloque.hora_fin, user.id_usuario);
      }
    }

    await horariosRepository.marcarConfirmado(solicitud.id_tienda, solicitud.semana_inicio, user.id_usuario);
  }

  return {
    message: aprobar
      ? 'Solicitud aprobada. El horario oficial fue actualizado.'
      : 'Solicitud rechazada.'
  };
}

function listSolicitudes(user, query) {
  const idTienda = user.rol === 'TIENDA'
    ? user.id_tienda
    : (query.id_tienda ? parseInt(query.id_tienda, 10) : undefined);

  return horariosRepository.findSolicitudesConJoins({ idTienda, estado: query.estado });
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
  getHorarioSemana,
  bulkUpdateHorario,
  crearSolicitud,
  resolverSolicitudService,
  listSolicitudes,
  updateDiaDescanso
};
