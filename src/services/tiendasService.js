const tiendasRepository = require('../repositories/tiendasRepository');
const AppError = require('../errors/AppError');

const TIPOS_VALIDOS = ['TIENDA', 'OFICINA', 'LOGISTICA'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  await tiendasRepository.insert({
    nombreTienda: nombre_tienda.trim(),
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

  await tiendasRepository.update(id, {
    nombreTienda: nombre_tienda.trim(),
    codigoAlmacen: codigo_almacen ? codigo_almacen.trim() : null,
    correoTienda: correo,
    rangoCodigos: rango_codigos ? rango_codigos.trim() : null
  });

  return { message: 'Sede actualizada exitosamente.' };
}

module.exports = { createTienda, updateTienda };
