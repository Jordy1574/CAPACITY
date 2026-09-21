const ExcelJS = require('exceljs');
const tiendasRepository = require('../repositories/tiendasRepository');
const empleadosRepository = require('../repositories/empleadosRepository');
const horariosRepository = require('../repositories/horariosRepository');
const novedadesRepository = require('../repositories/novedadesRepository');
const { getDaysInMonth, getMondayOf, getWeekDates, addDaysToDateStr, mesActual, horaAMinutos } = require('../utils/dates');
const AppError = require('../errors/AppError');

const DIAS_ES = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const HORAS_SEMANA_ESTANDAR = { FT: 48, PT: 23.5 };

const TIPO_NOVEDAD_LABEL = {
  VACACIONES: 'Vacaciones',
  DESCANSO_MEDICO: 'Descanso médico',
  FALTA: 'Falta',
  PERMISO: 'Permiso',
  LICENCIA: 'Licencia'
};

// Todas las semanas (lunes) que tocan el mes, incluida la que arranca en el
// mes anterior y la que termina en el siguiente.
function semanasDelMes(mes) {
  const dias = getDaysInMonth(mes);
  const ultimo = dias[dias.length - 1];
  const semanas = [];
  let lunes = getMondayOf(dias[0]);
  while (lunes <= ultimo) {
    semanas.push(lunes);
    lunes = addDaysToDateStr(lunes, 7);
  }
  return semanas;
}

function horasDeBloques(bloques) {
  return (bloques || []).reduce((sum, b) => {
    const inicio = horaAMinutos(b.hora_inicio);
    let fin = horaAMinutos(b.hora_fin);
    if (fin <= inicio) fin += 24 * 60;
    return sum + (fin - inicio);
  }, 0) / 60;
}

function textoTurno(bloques) {
  if (!bloques || bloques.length === 0) return '';
  return bloques
    .slice()
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    .map(b => `${b.hora_inicio}-${b.hora_fin}`)
    .join(' / ');
}

function horasContrato(emp) {
  if (emp.horas_semana !== null && emp.horas_semana !== undefined) return Number(emp.horas_semana);
  return HORAS_SEMANA_ESTANDAR[emp.regimen] ?? HORAS_SEMANA_ESTANDAR.FT;
}

// Excel no admite : \ / ? * [ ] en el nombre de hoja y lo corta en 31 caracteres.
function nombreHoja(semanaInicio, weekDates) {
  const [, mIni, dIni] = semanaInicio.split('-');
  const [, mFin, dFin] = weekDates[6].split('-');
  return `${dIni}-${mIni} al ${dFin}-${mFin}`;
}

async function construirSemana(idTienda, semanaInicio) {
  const weekDates = getWeekDates(semanaInicio);
  const empleados = await empleadosRepository.getActiveEmpleados(idTienda, semanaInicio);
  if (empleados.length === 0) return { weekDates, empleados: [], periodo: null };

  const empIds = empleados.map(e => e.id_empleado);
  const turnos = await horariosRepository.findTurnosForFechas(weekDates, empIds);
  const novedades = await novedadesRepository.findEnRango(empIds, weekDates[0], weekDates[6]);
  const periodo = await horariosRepository.getSemana(idTienda, semanaInicio);

  const porEmpleadoFecha = {};
  turnos.forEach(t => {
    const fecha = String(t.fecha).substring(0, 10);
    const key = `${t.id_empleado}_${fecha}`;
    if (!porEmpleadoFecha[key]) porEmpleadoFecha[key] = [];
    porEmpleadoFecha[key].push({ hora_inicio: t.hora_inicio, hora_fin: t.hora_fin });
  });

  const novedadesPorEmpleado = {};
  novedades.forEach(n => {
    if (!novedadesPorEmpleado[n.id_empleado]) novedadesPorEmpleado[n.id_empleado] = [];
    novedadesPorEmpleado[n.id_empleado].push(n);
  });

  return {
    weekDates,
    periodo,
    empleados: empleados.map(emp => ({
      ...emp,
      dias: weekDates.map(f => porEmpleadoFecha[`${emp.id_empleado}_${f}`] || []),
      novedades: novedadesPorEmpleado[emp.id_empleado] || []
    }))
  };
}

function pintarHoja(hoja, tienda, semanaInicio, datos) {
  const { weekDates, empleados, periodo } = datos;
  const esOficial = Boolean(periodo?.confirmado_por);

  hoja.mergeCells(1, 1, 1, 5 + weekDates.length);
  const titulo = hoja.getCell(1, 1);
  titulo.value = `${tienda.nombre_tienda}${tienda.codigo_almacen ? ` (${tienda.codigo_almacen})` : ''}  ·  Semana del ${weekDates[0]} al ${weekDates[6]}  ·  ${esOficial ? 'HORARIO OFICIAL' : 'SIN CONFIRMAR'}`;
  titulo.font = { bold: true, size: 12 };
  titulo.alignment = { vertical: 'middle' };
  hoja.getRow(1).height = 22;

  const encabezado = [
    'Colaborador',
    'Código',
    'Régimen',
    ...weekDates.map(f => {
      const d = new Date(`${f}T00:00:00`);
      return `${DIAS_ES[d.getDay()]} ${f.split('-')[2]}`;
    }),
    'Horas',
    'Contrato',
    'Extras',
    'Descanso',
    'Novedades'
  ];
  const filaEnc = hoja.addRow([]);
  filaEnc.values = encabezado;
  filaEnc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  filaEnc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  filaEnc.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD81B60' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  if (empleados.length === 0) {
    hoja.addRow(['Sin colaboradores registrados en esta sede para la semana.']);
    return;
  }

  empleados.forEach(emp => {
    const horas = emp.dias.reduce((sum, bloques) => sum + horasDeBloques(bloques), 0);
    const contrato = horasContrato(emp);
    const extras = horas - contrato;

    const fila = hoja.addRow([
      emp.nombre_completo,
      emp.codigo_empleado || 'SIN CODIGO',
      emp.regimen || 'FT',
      ...emp.dias.map(textoTurno),
      Number(horas.toFixed(2)),
      contrato,
      Number(extras.toFixed(2)),
      emp.dia_descanso || '',
      emp.novedades.map(n => `${TIPO_NOVEDAD_LABEL[n.tipo] || n.tipo} (${n.fecha_inicio} a ${n.fecha_fin})`).join('; ')
    ]);

    fila.eachCell(cell => {
      cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, bottom: { style: 'hair' }, right: { style: 'hair' } };
      cell.alignment = { vertical: 'middle' };
    });
    // Los días y los totales centrados; el resto alineado a la izquierda.
    for (let i = 4; i <= 3 + weekDates.length + 3; i++) {
      fila.getCell(i).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    // Resalta las horas por encima de la jornada pactada.
    if (extras > 0.01) {
      const celdaExtras = fila.getCell(3 + weekDates.length + 3);
      celdaExtras.font = { bold: true, color: { argb: 'FFB45309' } };
    }
    if (emp.situacion === 'NO_COMISIONA') {
      fila.getCell(1).font = { italic: true };
    }
  });

  hoja.columns.forEach((col, i) => {
    if (i === 0) col.width = 34;
    else if (i === 1 || i === 2) col.width = 11;
    else if (i <= 2 + weekDates.length) col.width = 15;
    else col.width = 12;
  });
  hoja.getColumn(encabezado.length).width = 38;
  hoja.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];
}

// Un libro con el mes completo: una hoja por semana, más una hoja resumen.
async function exportarMesXlsx(mesInput, idTiendaInput) {
  const mes = /^\d{4}-\d{2}$/.test(mesInput || '') ? mesInput : mesActual();
  const idTienda = parseInt(idTiendaInput, 10);
  if (!idTienda) {
    throw new AppError('Debes indicar la sede a exportar.', 400);
  }

  const tienda = await tiendasRepository.findById(idTienda);
  if (!tienda) {
    throw new AppError('Sede no encontrada.', 404);
  }

  const libro = new ExcelJS.Workbook();
  libro.creator = 'bissú Capacity';
  libro.created = new Date();

  const semanas = semanasDelMes(mes);
  const resumen = [];

  for (const semanaInicio of semanas) {
    const datos = await construirSemana(idTienda, semanaInicio);
    const hoja = libro.addWorksheet(nombreHoja(semanaInicio, datos.weekDates));
    pintarHoja(hoja, tienda, semanaInicio, datos);

    datos.empleados.forEach(emp => {
      const horas = emp.dias.reduce((sum, b) => sum + horasDeBloques(b), 0);
      resumen.push({
        nombre: emp.nombre_completo,
        semana: `${datos.weekDates[0]} a ${datos.weekDates[6]}`,
        horas,
        contrato: horasContrato(emp),
        oficial: Boolean(datos.periodo?.confirmado_por)
      });
    });
  }

  // Hoja final con el acumulado del mes por colaborador.
  const hojaResumen = libro.addWorksheet('Resumen del mes');
  hojaResumen.addRow([`${tienda.nombre_tienda} · Acumulado de ${MESES_ES[parseInt(mes.split('-')[1], 10) - 1]} ${mes.split('-')[0]}`]).font = { bold: true, size: 12 };
  const encRes = hojaResumen.addRow(['Colaborador', 'Semanas con turno', 'Horas del mes', 'Semanas oficiales']);
  encRes.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encRes.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD81B60' } };
  });

  const porColaborador = {};
  resumen.forEach(r => {
    if (!porColaborador[r.nombre]) porColaborador[r.nombre] = { horas: 0, semanas: 0, oficiales: 0 };
    porColaborador[r.nombre].horas += r.horas;
    if (r.horas > 0) porColaborador[r.nombre].semanas++;
    if (r.oficial) porColaborador[r.nombre].oficiales++;
  });
  Object.entries(porColaborador)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([nombre, d]) => hojaResumen.addRow([nombre, d.semanas, Number(d.horas.toFixed(2)), d.oficiales]));

  hojaResumen.getColumn(1).width = 34;
  hojaResumen.getColumn(2).width = 18;
  hojaResumen.getColumn(3).width = 15;
  hojaResumen.getColumn(4).width = 18;

  const buffer = await libro.xlsx.writeBuffer();
  const nombreArchivo = `horarios_${tienda.nombre_tienda.replace(/[^A-Za-z0-9]/g, '_')}_${mes}.xlsx`;
  return { buffer, nombreArchivo };
}

module.exports = { exportarMesXlsx };
