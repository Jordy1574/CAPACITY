const tiendasRepository = require('../repositories/tiendasRepository');
const { normalizarNombre } = require('../utils/texto');
const AppError = require('../errors/AppError');

const TIPOS_VALIDOS = ['TIENDA', 'OFICINA', 'LOGISTICA'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Los rangos vienen como '0310-0319'. Se comparan como números para detectar
// solapes: dos tiendas con rangos cruzados terminan asignando el mismo código
// de vendedor a personas distintas.
function parsearRango(rango) {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(rango || '').trim());
  if (!m) return null;
  return { desde: parseInt(m[1], 10), hasta: parseInt(m[2], 10) };
}

async function assertRangoLibre(rangoCodigos, idTiendaActual = null) {
  if (!rangoCodigos) return;

  const nuevo = parsearRango(rangoCodigos);
  if (!nuevo) {
    throw new AppError('El rango de códigos debe tener el formato 0100-0109.', 400);
  }
  if (nuevo.hasta < nuevo.desde) {
    throw new AppError('El código final del rango debe ser mayor o igual al inicial.', 400);
  }

  const tiendas = await tiendasRepository.listAll();
  for (const t of tiendas) {
    if (t.id_tienda === idTiendaActual) continue;
    const otro = parsearRango(t.rango_codigos);
    if (!otro) continue;
    if (nuevo.desde <= otro.hasta && otro.desde <= nuevo.hasta) {
      throw new AppError(
        `El rango ${rangoCodigos} se cruza con el de ${t.nombre_tienda} (${t.rango_codigos}). Dos sedes no pueden compartir códigos de vendedor.`,
        400
      );
    }
  }
}

function normalizarCorreo(correoTienda) {
  const correo = correoTienda && correoTienda.trim() ? correoTienda.trim() : null;
  if (correo && !EMAIL_REGEX.test(correo)) {
    throw new AppError('El correo de la sede no es válido.', 400);
  }
  return correo;
}

async function createTienda({ nombre_tienda, tipo, codigo_almacen, correo_tienda, rango_codigos }) {
  if (!nombre_tienda || !nombre_tienda.trim()) {
    throw new AppError('Debes indicar el nombre de la sede.', 400);
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new AppError('Tipo de sede inválido.', 400);
  }

  const correo = normalizarCorreo(correo_tienda);
  if (correo) {
    const existing = await tiendasRepository.findByCorreo(correo);
    if (existing) {
      throw new AppError('Ya existe una sede con este correo.', 400);
    }
  }

  await assertRangoLibre(rango_codigos);

  await tiendasRepository.insert({
    nombreTienda: normalizarNombre(nombre_tienda),
    codigoAlmacen: codigo_almacen ? codigo_almacen.trim() : null,
    correoTienda: correo,
    tipo,
    rangoCodigos: rango_codigos ? rango_codigos.trim() : null
  });

  return { message: 'Sede creada exitosamente.' };
}

async function updateTienda(id, { nombre_tienda, codigo_almacen, correo_tienda, rango_codigos }) {
  const tienda = await tiendasRepository.findById(id);
  if (!tienda) {
    throw new AppError('Sede no encontrada.', 404);
  }
  if (!nombre_tienda || !nombre_tienda.trim()) {
    throw new AppError('Debes indicar el nombre de la sede.', 400);
  }

  const correo = normalizarCorreo(correo_tienda);
  if (correo) {
    const existing = await tiendasRepository.findByCorreo(correo);
    if (existing && existing.id_tienda !== id) {
      throw new AppError('Ya existe una sede con este correo.', 400);
    }
  }

  await assertRangoLibre(rango_codigos, id);

  await tiendasRepository.update(id, {
    nombreTienda: normalizarNombre(nombre_tienda),
    codigoAlmacen: codigo_almacen ? codigo_almacen.trim() : null,
    correoTienda: correo,
    rangoCodigos: rango_codigos ? rango_codigos.trim() : null
  });

  return { message: 'Sede actualizada exitosamente.' };
}

module.exports = { createTienda, updateTienda, assertRangoLibre, parsearRango };
