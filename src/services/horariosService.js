const tiendasRepository = require('../repositories/tiendasRepository');
const empleadosRepository = require('../repositories/empleadosRepository');
const horariosRepository = require('../repositories/horariosRepository');
const capacityService = require('./capacityService');
const novedadesRepository = require('../repositories/novedadesRepository');
const { getMondayOf, getWeekDates, todayStr } = require('../utils/dates');
const { ROLES_ADMIN } = require('../middleware/roles');
const { withTransaction } = require('../config/db');
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

// Una cuenta ligada a un empleado (Oficina/Logística) solo puede ver y
// registrar SU propio horario. La cuenta compartida de una tienda no tiene
// id_empleado: la encargada llena el horario de todo su equipo.
function empleadoPropioDe(user) {
  return user.rol === 'TIENDA' && user.id_empleado ? user.id_empleado : null;
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

  const idEmpleadoPropio = empleadoPropioDe(user);
  const todosLosEmpleados = await empleadosRepository.getActiveEmpleados(idTienda, semanaInicio, undefined, weekDates[6]);
  const empleados = idEmpleadoPropio
    ? todosLosEmpleados.filter((e) => e.id_empleado === idEmpleadoPropio)
    : todosLosEmpleados;
  const periodo = await horariosRepository.getSemana(idTienda, semanaInicio);
  const solicitudPendiente = await horariosRepository.getSolicitudPendiente(idTienda, semanaInicio);

  let solicitudCambios = [];
  if (solicitudPendiente) {
    solicitudCambios = await horariosRepository.getCambiosDeSolicitud(solicitudPendiente.id_solicitud);
  }

  const solicitudInfo = solicitudPendiente
    ? {
        id_solicitud: solicitudPendiente.id_solicitud,
        motivo: solicitudPendiente.motivo,
        fecha_solicitud: solicitudPendiente.fecha_solicitud,
        solicitado_por_email: solicitudPendiente.solicitado_por_email,
        // Se envía al aprobar: si no coincide con la de la base, es que la
        // tienda corrigió la solicitud después de abrirla.
        version: solicitudPendiente.version,
        cambios: solicitudCambios
      }
    : null;

  if (empleados.length === 0) {
    return { tienda, semana_inicio: semanaInicio, dias_semana: weekDates, empleados: [], periodo, solicitud_pendiente: solicitudInfo };
  }

  const empIds = empleados.map(e => e.id_empleado);
  const turnoRecords = await horariosRepository.findTurnosForFechas(weekDates, empIds);
  const novedades = await novedadesRepository.findEnRango(empIds, weekDates[0], weekDates[6]);

  const novedadesPorEmpleado = {};
  novedades.forEach(n => {
    if (!novedadesPorEmpleado[n.id_empleado]) novedadesPorEmpleado[n.id_empleado] = [];
    novedadesPorEmpleado[n.id_empleado].push(n);
  });

  const turnosMap = {};
  turnoRecords.forEach(rec => {
    if (!turnosMap[rec.id_empleado]) turnosMap[rec.id_empleado] = {};
    if (!turnosMap[rec.id_empleado][rec.fecha]) turnosMap[rec.id_empleado][rec.fecha] = [];
    turnosMap[rec.id_empleado][rec.fecha].push({ hora_inicio: rec.hora_inicio, hora_fin: rec.hora_fin });
  });

  // El horario oficial se muestra siempre tal cual está guardado, sin
  // mezclar los cambios propuestos por una solicitud pendiente — esta debe
  // verse aparte (banner + overlay de revisión) hasta que se apruebe.
  const empleadosConDias = empleados.map(emp => {
    const diasObj = {};
    weekDates.forEach(fecha => {
      diasObj[fecha] = turnosMap[emp.id_empleado]?.[fecha] ?? [];
    });
    return { ...emp, dias: diasObj, novedades: novedadesPorEmpleado[emp.id_empleado] || [] };
  });

  return { tienda, semana_inicio: semanaInicio, dias_semana: weekDates, empleados: empleadosConDias, periodo, solicitud_pendiente: solicitudInfo };
}

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function horaToMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

const MINUTOS_DIA = 24 * 60;

// Valida formato, orden y solapes de los bloques de turno de un día,
// y los devuelve ordenados por hora de inicio listos para guardar.
// Un bloque cuyo fin es menor que su inicio (ej. 22:00-02:00) cruza la
// medianoche: se interpreta que termina en la madrugada del día siguiente.
function validarBloquesTurno(turnos) {
  const bloques = turnos.map(t => {
    if (!t || !HORA_REGEX.test(t.hora_inicio) || !HORA_REGEX.test(t.hora_fin)) {
      throw new AppError('Formato de hora inválido. Usa HH:MM.', 400);
    }
    const inicio = horaToMinutos(t.hora_inicio);
    let fin = horaToMinutos(t.hora_fin);
    if (fin === inicio) {
      throw new AppError('La hora de fin no puede ser igual a la de inicio.', 400);
    }
    if (fin < inicio) {
      fin += MINUTOS_DIA;
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

const DIA_DESCANSO_A_INDICE = { DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };

// Si se le asigna turno el día que tenía declarado como descanso, ese descanso
// deja de tener sentido: no se puede descansar un día en el que se trabaja.
// Se limpia de la ficha del colaborador para que no quede una contradicción
// arrastrándose de semana en semana; luego se le asigna el que corresponda.
// Aplica en cualquier via de escritura (edición en vivo o aprobación).
async function limpiarDescansoEnConflicto(cambios, queryFn) {
  const conTurno = (cambios || []).filter(c => (c.turnos || []).length > 0);
  if (conTurno.length === 0) return;

  const empIds = [...new Set(conTurno.map(c => c.id_empleado))];
  const empleados = await empleadosRepository.findByIds(empIds, queryFn);
  const porId = {};
  empleados.forEach(e => { porId[e.id_empleado] = e; });

  const limpiados = new Set();
  for (const cambio of conTurno) {
    const emp = porId[cambio.id_empleado];
    if (!emp?.dia_descanso || limpiados.has(emp.id_empleado)) continue;

    const diaSemana = new Date(`${String(cambio.fecha).substring(0, 10)}T00:00:00`).getDay();
    if (diaSemana === DIA_DESCANSO_A_INDICE[emp.dia_descanso]) {
      await empleadosRepository.updateDiaDescanso(emp.id_empleado, null, queryFn);
      limpiados.add(emp.id_empleado);
    }
  }
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
    const idEmpleadoPropio = empleadoPropioDe(user);
    if (idEmpleadoPropio && empIdsToUpdate.some((id) => id !== idEmpleadoPropio)) {
      throw new AppError('Acceso denegado: solo puedes registrar tu propio horario.', 403);
    }
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
  await withTransaction(async (txQuery) => {
    for (const cambio of cambios) {
      const { id_empleado, fecha, turnos } = cambio;
      if (!id_empleado || !fecha || !Array.isArray(turnos)) continue;

      const bloques = validarBloquesTurno(turnos);

      await horariosRepository.deleteTurnosForDia(id_empleado, fecha, txQuery);
      for (const bloque of bloques) {
        await horariosRepository.insertTurno(id_empleado, fecha, bloque.hora_inicio, bloque.hora_fin, user.id_usuario, txQuery);
      }
      updatedCount++;
    }

    await limpiarDescansoEnConflicto(cambios, txQuery);
  });

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

  const idEmpleadoPropio = empleadoPropioDe(user);
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
    if (idEmpleadoPropio && empIds.some((id) => id !== idEmpleadoPropio)) {
      throw new AppError('Acceso denegado: solo puedes enviar tu propio horario.', 403);
    }
    await verificarEmpleadosDeTienda(empIds, idTienda);
    cambios = cambiosInput.map(c => ({
      id_empleado: c.id_empleado,
      fecha: c.fecha,
      turnos: validarBloquesTurno(c.turnos || [])
    }));
  } else {
    motivo = (motivoInput || '').trim() || autoMotivo(semanaInicio, weekDates);
    const empleados = await empleadosRepository.getActiveEmpleados(idTienda, semanaInicio);
    const empIds = empleados
      .map(e => e.id_empleado)
      .filter(id => !idEmpleadoPropio || id === idEmpleadoPropio);
    const turnoRecords = empIds.length ? await horariosRepository.findTurnosForFechas(weekDates, empIds) : [];
    const agrupado = {};
    turnoRecords.forEach(rec => {
      const key = `${rec.id_empleado}_${rec.fecha}`;
      if (!agrupado[key]) agrupado[key] = { id_empleado: rec.id_empleado, fecha: rec.fecha, turnos: [] };
      agrupado[key].turnos.push({ hora_inicio: rec.hora_inicio, hora_fin: rec.hora_fin });
    });
    cambios = Object.values(agrupado);
  }

  await withTransaction((txQuery) =>
    horariosRepository.crearSolicitud(idTienda, semanaInicio, motivo, user.id_usuario, cambios, txQuery)
  );

  return { message: 'Horario enviado para aprobación. Un Admin/Supervisor/RRHH debe confirmarlo para que quede oficial.' };
}

// La tienda corrige su propia solicitud mientras siga pendiente. Se actualiza
// la misma solicitud en vez de borrar y crear otra: así el id que el admin
// tiene abierto sigue siendo válido y la condición "estado = PENDIENTE" del
// UPDATE decide quién gana si ambos actúan a la vez.
async function actualizarSolicitud(user, idSolicitud, motivoInput, cambiosInput) {
  const solicitud = await horariosRepository.findSolicitudById(idSolicitud);
  if (!solicitud) {
    throw new AppError('Solicitud no encontrada.', 404);
  }
  if (user.rol === 'TIENDA' && solicitud.id_tienda !== user.id_tienda) {
    throw new AppError('Acceso denegado: la solicitud es de otra sede.', 403);
  }
  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError(
      `Esta solicitud ya fue ${solicitud.estado === 'APROBADA' ? 'aprobada' : 'rechazada'}. Recarga la página para ver el horario vigente.`,
      409
    );
  }
  if (!Array.isArray(cambiosInput) || cambiosInput.length === 0) {
    throw new AppError('No hay cambios que enviar.', 400);
  }

  const empIds = [...new Set(cambiosInput.map(c => c.id_empleado))];
  const idEmpleadoPropio = empleadoPropioDe(user);
  if (idEmpleadoPropio && empIds.some((id) => id !== idEmpleadoPropio)) {
    throw new AppError('Acceso denegado: solo puedes enviar tu propio horario.', 403);
  }
  await verificarEmpleadosDeTienda(empIds, solicitud.id_tienda);

  const motivo = (motivoInput || '').trim() || solicitud.motivo;
  const cambios = cambiosInput.map(c => ({
    id_empleado: c.id_empleado,
    fecha: c.fecha,
    turnos: validarBloquesTurno(c.turnos || [])
  }));

  const actualizada = await withTransaction((txQuery) =>
    horariosRepository.actualizarSolicitudPendiente(idSolicitud, motivo, cambios, txQuery)
  );

  if (!actualizada) {
    throw new AppError(
      'La solicitud dejó de estar pendiente mientras la editabas: un Admin/Supervisor/RRHH acaba de resolverla. Recarga para ver el horario vigente.',
      409
    );
  }

  return { message: 'Solicitud actualizada y reenviada para aprobación.' };
}

async function resolverSolicitudService(user, idSolicitud, aprobar, comentario, cambiosFinales, versionEsperada) {
  const solicitud = await horariosRepository.findSolicitudById(idSolicitud);
  if (!solicitud) {
    throw new AppError('Solicitud no encontrada.', 404);
  }
  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError('Esta solicitud ya fue resuelta anteriormente.', 400);
  }

  const nuevoEstado = aprobar ? 'APROBADA' : 'RECHAZADA';
  const cambios = aprobar
    ? (Array.isArray(cambiosFinales) && cambiosFinales.length > 0
        ? cambiosFinales
        : await horariosRepository.getCambiosDeSolicitud(idSolicitud))
    : [];

  // Todo ocurre en una sola transacción y empieza por el cambio de estado,
  // que solo prospera si la solicitud sigue pendiente. Si la tienda la
  // reemplazó o alguien más la resolvió en el intermedio, no se aplica ningún
  // turno: se aborta entera y se avisa.
  await withTransaction(async (txQuery) => {
    const gano = await horariosRepository.resolverSolicitud(idSolicitud, nuevoEstado, user.id_usuario, comentario || null, versionEsperada, txQuery);
    if (gano.length === 0) {
      throw new AppError('La solicitud cambió mientras la revisabas: la tienda la corrigió o alguien más la resolvió. Ciérrala y vuelve a abrirla para ver la versión vigente.', 409);
    }

    if (!aprobar) return;

    for (const cambio of cambios) {
      const bloques = validarBloquesTurno(cambio.turnos || []);
      await horariosRepository.deleteTurnosForDia(cambio.id_empleado, cambio.fecha, txQuery);
      for (const bloque of bloques) {
        await horariosRepository.insertTurno(cambio.id_empleado, cambio.fecha, bloque.hora_inicio, bloque.hora_fin, user.id_usuario, txQuery);
      }
    }
    await horariosRepository.marcarConfirmado(solicitud.id_tienda, solicitud.semana_inicio, user.id_usuario, txQuery);
    await limpiarDescansoEnConflicto(cambios, txQuery);

    // El horario oficial es la fuente del capacity: al quedar confirmada la
    // semana, se marca 1 en los días con turno y 0 en los que no.
    await capacityService.sincronizarCapacityDesdeHorario(
      solicitud.id_tienda,
      solicitud.semana_inicio,
      user.id_usuario,
      txQuery
    );
  });

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
  const idEmpleadoPropio = empleadoPropioDe(user);
  if (idEmpleadoPropio && idEmpleado !== idEmpleadoPropio) {
    throw new AppError('Acceso denegado: solo puedes editar tu propio registro.', 403);
  }

  const valor = diaDescanso ? String(diaDescanso).trim().toUpperCase() : null;
  if (valor && !DIAS_DESCANSO_VALIDOS.includes(valor)) {
    throw new AppError('Día de descanso inválido.', 400);
  }

  await empleadosRepository.updateDiaDescanso(idEmpleado, valor);
  return { message: 'Día de descanso actualizado.' };
}

const TIPOS_NOVEDAD = ['VACACIONES', 'DESCANSO_MEDICO', 'FALTA', 'PERMISO', 'LICENCIA'];

// Una tienda solo puede registrar novedades de su propio equipo; una cuenta
// personal (Oficina/Logística), solo las suyas.
async function assertPuedeGestionarEmpleado(user, idEmpleado) {
  const emp = await empleadosRepository.findById(idEmpleado);
  if (!emp) {
    throw new AppError('Colaborador no encontrado.', 404);
  }
  if (user.rol === 'TIENDA') {
    if (emp.id_tienda !== user.id_tienda) {
      throw new AppError('Acceso denegado: colaborador de otra sede.', 403);
    }
    const idEmpleadoPropio = empleadoPropioDe(user);
    if (idEmpleadoPropio && idEmpleado !== idEmpleadoPropio) {
      throw new AppError('Acceso denegado: solo puedes registrar tus propias novedades.', 403);
    }
  }
  return emp;
}

function listarNovedades(user, idEmpleado) {
  return assertPuedeGestionarEmpleado(user, idEmpleado).then(() => novedadesRepository.findByEmpleado(idEmpleado));
}

async function crearNovedad(user, { id_empleado, tipo, fecha_inicio, fecha_fin, con_goce, observacion }) {
  const idEmpleado = parseInt(id_empleado, 10);
  await assertPuedeGestionarEmpleado(user, idEmpleado);

  if (!TIPOS_NOVEDAD.includes(tipo)) {
    throw new AppError('Tipo de novedad inválido.', 400);
  }
  if (!FECHA_REGEX.test(fecha_inicio || '') || !FECHA_REGEX.test(fecha_fin || '')) {
    throw new AppError('Debes indicar fechas válidas (YYYY-MM-DD).', 400);
  }
  if (fecha_fin < fecha_inicio) {
    throw new AppError('La fecha de fin no puede ser anterior a la de inicio.', 400);
  }

  await novedadesRepository.insert({
    idEmpleado,
    tipo,
    fechaInicio: fecha_inicio,
    fechaFin: fecha_fin,
    conGoce: con_goce !== false,
    observacion: observacion ? String(observacion).trim() : null,
    registradoPor: user.id_usuario
  });

  return { message: 'Novedad registrada.' };
}

async function eliminarNovedad(user, idNovedad) {
  const novedad = await novedadesRepository.findById(idNovedad);
  if (!novedad) {
    throw new AppError('Novedad no encontrada.', 404);
  }
  await assertPuedeGestionarEmpleado(user, novedad.id_empleado);
  await novedadesRepository.remove(idNovedad);
  return { message: 'Novedad eliminada.' };
}

module.exports = {
  getHorarioSemana,
  listarNovedades,
  crearNovedad,
  eliminarNovedad,
  actualizarSolicitud,
  bulkUpdateHorario,
  crearSolicitud,
  resolverSolicitudService,
  listSolicitudes,
  updateDiaDescanso
};
