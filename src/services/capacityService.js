const tiendasRepository = require('../repositories/tiendasRepository');
const empleadosRepository = require('../repositories/empleadosRepository');
const capacityRepository = require('../repositories/capacityRepository');
const horariosRepository = require('../repositories/horariosRepository');
const { getDaysInMonth, getWeekDates, getMondayOf, mesActual, horaAMinutos } = require('../utils/dates');
const { normalizarNombre } = require('../utils/texto');
const { parsearRango } = require('./tiendasService');
const { ROLES_ADMIN } = require('../middleware/roles');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

// NO_COMISIONA: el colaborador trabaja y se le arma horario, pero no suma
// capacity (sus días quedan en 0 y no cuenta para el promedio de la tienda).
const SITUACIONES_VALIDAS = ['ACTIVO', 'INACTIVO', 'NO_COMISIONA'];

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
    mes = mesActual();
  }
  const firstDayOfMonth = `${mes}-01`;

  const idTienda = resolveTiendaId(user, queryIdTienda);

  const tienda = await tiendasRepository.findById(idTienda);
  if (!tienda) {
    throw new AppError('Tienda no encontrada.', 404);
  }

  // Una cuenta personal (Oficina/Logística) solo ve su propia fila; la
  // cuenta compartida de una tienda ve a todo su equipo.
  const ultimoDiaDelMes = getDaysInMonth(mes).slice(-1)[0];
  const todosLosEmpleados = await empleadosRepository.getActiveEmpleados(idTienda, firstDayOfMonth, undefined, ultimoDiaDelMes);
  const empleados = user.rol === 'TIENDA' && user.id_empleado
    ? todosLosEmpleados.filter(e => e.id_empleado === user.id_empleado)
    : todosLosEmpleados;

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
    return { ...emp, dotacion: dotacionDe(emp.regimen), dias: diasObj };
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

function limpiar(valor) {
  const v = String(valor ?? '').trim();
  return v === '' ? null : v;
}

// Datos que pertenecen a la persona y no al puesto que ocupa en una sede: se
// mantienen iguales en todas sus fichas. El código de vendedor NO entra acá,
// porque es propio de cada tienda.
const CAMPOS_DE_LA_PERSONA = ['nombre_completo', 'celular', 'correo_asesor', 'regimen'];

async function createEmpleado(user, body) {
  const { dni, nombre_completo, puesto, regimen, celular, correo_asesor, codigo_empleado, id_tienda, fecha_ingreso, modo_traslado } = body || {};

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

  const dniLimpio = String(dni).trim();
  const fichas = await empleadosRepository.findAllByDni(dniLimpio);

  // Ya registrado en esta misma tienda: eso sí sigue siendo un duplicado.
  if (fichas.some(f => f.id_tienda === targetTiendaId)) {
    throw new AppError('Este colaborador ya está registrado en esta sede.', 400);
  }

  // Registrado en otra sede: puede ser apoyo (queda activo en ambas) o
  // traslado (se cierra la ficha anterior). Quien registra debe decidirlo.
  if (fichas.length > 0 && !modo_traslado) {
    const sedes = fichas.map(f => f.nombre_tienda).join(', ');
    throw new AppError(
      `${fichas[0].nombre_completo} ya está registrado en ${sedes}. Indica si es un apoyo o un traslado.`,
      409,
      {
        requiere_definir_modo: true,
        persona: {
          dni: dniLimpio,
          nombre_completo: fichas[0].nombre_completo,
          celular: fichas[0].celular,
          correo_asesor: fichas[0].correo_asesor,
          regimen: fichas[0].regimen
        },
        fichas: fichas.map(f => ({
          id_tienda: f.id_tienda,
          nombre_tienda: f.nombre_tienda,
          codigo_empleado: f.codigo_empleado,
          situacion: f.situacion
        }))
      }
    );
  }
  if (modo_traslado && !['APOYO', 'TRASLADO'].includes(modo_traslado)) {
    throw new AppError('Indica si el registro es un apoyo o un traslado.', 400);
  }

  const codigo = limpiar(codigo_empleado);
  if (codigo) {
    await assertCodigoLibre(targetTiendaId, codigo);
  }

  await withTransaction(async (txQuery) => {
    await empleadosRepository.insert({
      dni: dniLimpio,
      codigo_empleado: codigo,
      nombre_completo: normalizarNombre(nombre_completo),
      puesto: puesto || 'ASESOR DE VENTAS',
      regimen: regimen || 'FT',
      celular: limpiar(celular),
      correo_asesor: limpiar(correo_asesor),
      id_tienda: targetTiendaId,
      fecha_ingreso: limpiar(fecha_ingreso)
    }, txQuery);

    if (modo_traslado === 'TRASLADO') {
      const hoy = new Date().toISOString().substring(0, 10);
      for (const ficha of fichas) {
        await empleadosRepository.darDeBaja(ficha.id_empleado, fecha_ingreso || hoy, txQuery);
      }
    }
  });

  const detalle = modo_traslado === 'TRASLADO'
    ? ' Se cerró su registro en la sede anterior.'
    : modo_traslado === 'APOYO'
      ? ' Queda activo también en su sede de origen.'
      : '';
  return { message: `Colaborador registrado exitosamente.${detalle}` };
}

// Un código de vendedor no puede estar ocupado por otra persona en la misma
// tienda, ni salirse del rango asignado a esa sede. Como los rangos no se
// cruzan entre sedes, respetarlos es lo que evita que dos tiendas terminen
// usando el mismo código para personas distintas.
async function assertCodigoLibre(idTienda, codigo, idEmpleadoActual = null, validarRango = true) {
  const ocupado = await empleadosRepository.findByCodigoEnTienda(idTienda, codigo);
  if (ocupado && ocupado.id_empleado !== idEmpleadoActual) {
    throw new AppError(`El código ${codigo} ya está asignado a ${ocupado.nombre_completo} en esta sede.`, 400);
  }

  if (!validarRango) return;

  const tienda = await tiendasRepository.findById(idTienda);
  const rango = parsearRango(tienda?.rango_codigos);
  const numero = parseInt(codigo, 10);
  if (!rango || !Number.isFinite(numero)) return;

  if (numero < rango.desde || numero > rango.hasta) {
    throw new AppError(
      `El código ${codigo} está fuera del rango de ${tienda.nombre_tienda} (${tienda.rango_codigos}).`,
      400
    );
  }
}

async function updateEmpleado(user, idEmpleado, body) {
  const { dni, nombre_completo, puesto, regimen, celular, correo_asesor, codigo_empleado, situacion, fecha_baja, horas_semana, fecha_ingreso } = body || {};

  const emp = await empleadosRepository.findById(idEmpleado);
  if (!emp) {
    throw new AppError('Colaborador no encontrado.', 404);
  }

  if (user.rol === 'TIENDA' && emp.id_tienda !== user.id_tienda) {
    throw new AppError('Acceso denegado: Intento no autorizado de editar colaborador de otra sede.', 403);
  }

  if (situacion && !SITUACIONES_VALIDAS.includes(situacion)) {
    throw new AppError('Estado del colaborador inválido.', 400);
  }

  const cleanFechaBaja = situacion === 'INACTIVO' ? (fecha_baja || new Date().toISOString().substring(0, 10)) : null;
  const codigo = limpiar(codigo_empleado);
  if (codigo) {
    // El rango solo se exige cuando el código cambia: hay fichas antiguas con
    // códigos fuera del rango actual de su sede y editar otro dato no debe fallar.
    await assertCodigoLibre(emp.id_tienda, codigo, idEmpleado, codigo !== emp.codigo_empleado);
  }

  const datos = {
    dni: dni ? String(dni).trim() : null,
    nombre_completo: nombre_completo ? normalizarNombre(nombre_completo) : null,
    puesto: puesto || null,
    regimen: regimen || null,
    celular: limpiar(celular),
    correo_asesor: limpiar(correo_asesor),
    codigo_empleado: codigo,
    situacion: situacion || null,
    fecha_baja: cleanFechaBaja,
    horas_semana: horas_semana === undefined || horas_semana === '' ? null : horas_semana,
    fecha_ingreso: limpiar(fecha_ingreso)
  };

  // Si la persona está en más de una sede (apoyo), sus datos personales se
  // mantienen iguales en todas sus fichas. El código de vendedor, el estado y
  // la jornada son propios de cada tienda y no se propagan.
  const otrasFichas = (await empleadosRepository.findAllByDni(datos.dni || emp.dni))
    .filter(f => f.id_empleado !== idEmpleado);

  await withTransaction(async (txQuery) => {
    await empleadosRepository.update(idEmpleado, datos, txQuery);

    if (otrasFichas.length > 0) {
      const comunes = {};
      CAMPOS_DE_LA_PERSONA.forEach(campo => { comunes[campo] = datos[campo]; });
      for (const ficha of otrasFichas) {
        await empleadosRepository.updateDatosPersonales(ficha.id_empleado, comunes, txQuery);
      }
    }
  });

  const extra = otrasFichas.length > 0
    ? ` Sus datos personales se actualizaron también en ${otrasFichas.length} sede(s) donde está registrado.`
    : '';
  return { message: `Datos del colaborador actualizados exitosamente.${extra}` };
}

// La dotación es la plaza que ocupa la persona, no su asistencia:
// Full Time cuenta como 1 y Part Time como 0.5.
function dotacionDe(regimen) {
  return regimen === 'PT' ? 0.5 : 1;
}

// Franja comercial: el horario en que la tienda vende. El capacity mide días
// con venta, así que un turno íntegramente fuera de esta franja (madrugada o
// apertura muy temprana por mantenimiento, remodelación o correctivos) no
// cuenta como día trabajado, aunque sí sume horas en el horario.
const COMERCIAL_INICIO = 7 * 60; // 07:00
const COMERCIAL_FIN = 24 * 60; // hasta las 23:59

function tocaHorarioComercial(turno) {
  const inicio = horaAMinutos(turno.hora_inicio);
  let fin = horaAMinutos(turno.hora_fin);
  // Un turno que cruza medianoche termina en la madrugada del día siguiente;
  // solo se evalúa el tramo que cae dentro del propio día.
  if (fin <= inicio) fin += 24 * 60;
  return Math.min(fin, COMERCIAL_FIN) > Math.max(inicio, COMERCIAL_INICIO);
}

// El capacity ya no se llena a mano: se deriva del horario oficial. Cuando una
// semana queda confirmada, cada día de cada colaborador de esa sede se marca
// con 1 si tiene turno en franja comercial y 0 si no.
// Las lecturas usan el mismo queryFn de la transacción para ver los turnos que
// se acaban de aprobar dentro de ella.
async function sincronizarCapacityDesdeHorario(idTienda, semanaInicio, idUsuario, queryFn) {
  const weekDates = getWeekDates(semanaInicio);
  const empleados = await empleadosRepository.getActiveEmpleados(idTienda, semanaInicio, queryFn);
  if (empleados.length === 0) return 0;

  const empIds = empleados.map(e => e.id_empleado);
  const turnos = await horariosRepository.findTurnosForFechas(weekDates, empIds, queryFn);

  const diasConVenta = new Set(
    turnos
      .filter(tocaHorarioComercial)
      .map(t => `${t.id_empleado}_${String(t.fecha).substring(0, 10)}`)
  );

  let registros = 0;
  for (const emp of empleados) {
    // Un colaborador NO_COMISIONA sí puede tener horario, pero no suma
    // capacity: sus días quedan siempre en 0.
    const comisiona = emp.situacion !== 'NO_COMISIONA';
    for (const fecha of weekDates) {
      const valor = comisiona && diasConVenta.has(`${emp.id_empleado}_${fecha}`) ? 1 : 0;
      await capacityRepository.upsertRecord(emp.id_empleado, fecha, valor, idUsuario, queryFn);
      registros++;
    }
  }
  return registros;
}

// Formato largo (una fila por colaborador y día) para Power Query / Power BI.
async function exportCapacity(mesInput, idTiendaInput) {
  const mes = /^\d{4}-\d{2}$/.test(mesInput || '') ? mesInput : mesActual();
  const idTienda = idTiendaInput ? parseInt(idTiendaInput, 10) : null;

  const rows = await capacityRepository.findExportRows(mes, idTienda);
  const cubiertas = await fechasOficialesDelMes(mes, idTienda);

  return rows.map(r => {
    const fecha = String(r.fecha).substring(0, 10);
    return {
      fecha,
      dni: r.dni,
      codigo_empleado: r.codigo_empleado || 'EN PRUEBA',
      nombre_empleado: r.nombre_empleado,
      puesto: r.puesto,
      regimen: r.regimen,
      celular: r.celular || '',
      correo_asesor: r.correo_asesor || '',
      codigo_almacen: r.codigo_almacen,
      nombre_tienda: r.nombre_tienda,
      dotacion: dotacionDe(r.regimen),
      situacion: r.situacion,
      comisiona: r.situacion !== 'NO_COMISIONA',
      valor: parseFloat(r.valor),
      // Distingue un 0 de "no trabajó" de un 0 de "esa semana aún no se aprueba".
      semana_oficial: cubiertas.has(`${r.id_tienda}_${fecha}`),
      fecha_actualizacion: r.fecha_actualizacion || null
    };
  });
}

// Devuelve el set de fechas del mes que ya están cubiertas por una semana
// de horario confirmada, por tienda: `${id_tienda}_${fecha}`.
async function fechasOficialesDelMes(mes, idTienda) {
  const dias = getDaysInMonth(mes);
  const desde = getMondayOf(dias[0]);
  const hasta = dias[dias.length - 1];
  const semanas = await capacityRepository.findSemanasOficiales(desde, hasta, idTienda);

  const cubiertas = new Set();
  semanas.forEach(s => {
    getWeekDates(String(s.semana_inicio).substring(0, 10)).forEach(fecha => {
      cubiertas.add(`${s.id_tienda}_${fecha}`);
    });
  });
  return cubiertas;
}

// Resumen mensual: una fila por colaborador, ya con los días trabajados
// calculados, para que quien liquida bonos no rehaga la suma.
async function getResumenMensual(mesInput, idTiendaInput) {
  const mes = /^\d{4}-\d{2}$/.test(mesInput || '') ? mesInput : mesActual();
  const idTienda = idTiendaInput ? parseInt(idTiendaInput, 10) : null;

  const filas = await capacityRepository.findResumenMensual(mes, idTienda);
  const diasDelMes = getDaysInMonth(mes);
  const cubiertas = await fechasOficialesDelMes(mes, idTienda);

  // Detalle día por día, para no obligar a una segunda llamada. Un día sin
  // registro queda en null y no en 0: null es "todavía no hay dato" (la
  // semana no se ha aprobado) y 0 es "está confirmado que no trabajó".
  const registros = filas.length
    ? await capacityRepository.findRecordsForEmpleados(mes, filas.map(f => f.id_empleado))
    : [];
  const diasPorEmpleado = {};
  registros.forEach(r => {
    if (!diasPorEmpleado[r.id_empleado]) diasPorEmpleado[r.id_empleado] = {};
    diasPorEmpleado[r.id_empleado][String(r.fecha).substring(0, 10)] = Number(r.valor) > 0 ? 1 : 0;
  });

  const oficialesPorTienda = {};
  filas.forEach(f => {
    if (oficialesPorTienda[f.id_tienda] === undefined) {
      oficialesPorTienda[f.id_tienda] = diasDelMes.filter(d => cubiertas.has(`${f.id_tienda}_${d}`)).length;
    }
  });

  return {
    mes,
    dias_del_mes: diasDelMes.length,
    generado_en: new Date().toISOString(),
    colaboradores: filas.map(f => {
      const diasOficiales = oficialesPorTienda[f.id_tienda];
      return {
        dni: f.dni,
        codigo_empleado: f.codigo_empleado || null,
        nombre: f.nombre_completo,
        puesto: f.puesto,
        regimen: f.regimen,
        dotacion: dotacionDe(f.regimen),
        situacion: f.situacion,
        comisiona: f.situacion !== 'NO_COMISIONA',
        id_tienda: f.id_tienda,
        codigo_almacen: f.codigo_almacen,
        tienda: f.nombre_tienda,
        dias_trabajados: Number(f.dias_trabajados),
        // Señal de completitud: si no todos los días del mes están cubiertos
        // por un horario oficial, el dato todavía puede cambiar.
        dias_oficiales: diasOficiales,
        mes_completo: diasOficiales === diasDelMes.length,
        ultima_actualizacion: f.ultima_actualizacion || null,
        // 1 trabajó, 0 no trabajó, null sin dato. Incluye todos los días del
        // mes, también los que no tienen registro.
        dias: Object.fromEntries(
          diasDelMes.map(d => [d, diasPorEmpleado[f.id_empleado]?.[d] ?? null])
        )
      };
    })
  };
}

function celdaCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Exporta la matriz del mes tal como se ve en pantalla (una fila por
// colaborador, una columna por día) para abrirla en Excel.
async function exportCapacityCsv(user, mesInput, queryIdTienda) {
  const data = await getCapacityMatrix(user, mesInput, queryIdTienda);

  const encabezado = [
    'CODIGO_ALMACEN', 'TIENDA', 'DNI', 'CODIGO_EMPLEADO', 'NOMBRE', 'PUESTO',
    'REGIMEN', 'DOTACION', 'SITUACION', ...data.dias_mes, 'DIAS_TRABAJADOS'
  ];

  const filas = data.empleados.map(emp => {
    // Se normaliza a 1/0 igual que en pantalla: los meses viejos guardan
    // medios turnos (0.5) bajo la semántica anterior, y cualquier valor
    // mayor que cero significa que ese día trabajó.
    const dias = data.dias_mes.map(dia => (emp.dias[dia] === null ? '' : Number(emp.dias[dia]) > 0 ? 1 : 0));
    const diasTrabajados = data.dias_mes.reduce((acc, dia) => acc + (Number(emp.dias[dia]) > 0 ? 1 : 0), 0);
    return [
      data.tienda.codigo_almacen || '',
      data.tienda.nombre_tienda,
      emp.dni,
      emp.codigo_empleado || 'EN PRUEBA',
      emp.nombre_completo,
      emp.puesto || '',
      emp.regimen || '',
      emp.dotacion,
      emp.situacion,
      ...dias,
      diasTrabajados
    ];
  });

  // Excel en configuración regional es-PE espera ';' como separador; el BOM
  // hace que reconozca UTF-8 y no rompa las tildes.
  const csv = [encabezado, ...filas].map(fila => fila.map(celdaCsv).join(';')).join('\r\n');
  const nombreArchivo = `capacity_${data.tienda.nombre_tienda.replace(/[^A-Za-z0-9]/g, '_')}_${data.mes}.csv`;

  return { csv: `﻿${csv}`, nombreArchivo };
}

module.exports = {
  resolveTiendaId,
  getCapacityMatrix,
  exportCapacityCsv,
  createEmpleado,
  updateEmpleado,
  exportCapacity,
  getResumenMensual,
  sincronizarCapacityDesdeHorario,
  dotacionDe
};
