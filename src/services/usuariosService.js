const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const usuariosRepository = require('../repositories/usuariosRepository');
const tiendasRepository = require('../repositories/tiendasRepository');
const empleadosRepository = require('../repositories/empleadosRepository');
const auditoriaRepository = require('../repositories/auditoriaRepository');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

const ROLES_VALIDOS = ['TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generarPassword(length = 8) {
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += PASSWORD_CHARS[crypto.randomInt(0, PASSWORD_CHARS.length)];
  }
  return pass;
}

function slugify(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function generarUsernameUnico(nombreBase) {
  const base = slugify(nombreBase) || 'usuario';
  let candidato = base;
  let sufijo = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await usuariosRepository.findByUsername(candidato)) {
    sufijo += 1;
    candidato = `${base}${sufijo}`;
  }
  return candidato;
}

function identificadorDe(usuario) {
  return usuario.email || usuario.username || `usuario#${usuario.id_usuario}`;
}

// Un Supervisor solo puede gestionar cuentas operativas (Tienda/Oficina/
// Logística, todas con rol 'TIENDA'), nunca cuentas de Admin u otro
// Supervisor. Eliminar cuentas es exclusivo de Admin (ya filtrado por el
// middleware de la ruta, no se re-valida aquí).
function assertPuedeGestionar(requestingUser, targetRol) {
  if (requestingUser.rol === 'SUPERVISOR' && targetRol !== 'TIENDA') {
    throw new AppError('Acceso denegado: un Supervisor solo puede gestionar cuentas de Tienda, Oficina o Logística.', 403);
  }
}

function registrarAuditoria({ usuarioAfectado, accion, detalle, requestingUser }) {
  return auditoriaRepository.registrar({
    idUsuarioAfectado: usuarioAfectado.id_usuario,
    identificadorAfectado: identificadorDe(usuarioAfectado),
    accion,
    detalle,
    idUsuarioActor: requestingUser.id_usuario,
    actorIdentificador: identificadorDe(requestingUser)
  });
}

async function listUsuarios(requestingUser) {
  const usuarios = await usuariosRepository.listAll();
  if (requestingUser.rol === 'SUPERVISOR') {
    return usuarios.filter((u) => u.rol === 'TIENDA');
  }
  return usuarios;
}

function resolveIdTiendaForRol(rol, idTiendaInput) {
  if (rol === 'TIENDA') {
    const idTienda = idTiendaInput ? parseInt(idTiendaInput, 10) : null;
    if (!idTienda) {
      throw new AppError('Debes indicar la tienda para un usuario TIENDA.', 400);
    }
    return idTienda;
  }
  return null;
}

// Resuelve el empleado de una cuenta personal (Oficina/Logística): reutiliza
// la ficha si el DNI ya existe en esa sede, o la crea con los datos dados.
async function resolverEmpleadoDeCuenta(empleadoInput, tienda) {
  const { dni, nombre_completo, puesto, regimen, celular, correo_asesor } = empleadoInput || {};

  if (!dni || !String(dni).trim() || !nombre_completo || !nombre_completo.trim()) {
    throw new AppError('Debes indicar el DNI y el nombre completo del empleado.', 400);
  }

  const dniLimpio = String(dni).trim();
  const existente = await empleadosRepository.findByDni(dniLimpio);

  if (existente) {
    if (existente.id_tienda !== tienda.id_tienda) {
      throw new AppError('Ya existe un colaborador con este DNI en otra sede.', 400);
    }
    const cuentaPrevia = await usuariosRepository.findByEmpleado(existente.id_empleado);
    if (cuentaPrevia) {
      throw new AppError('Este colaborador ya tiene una cuenta asignada.', 400);
    }
    return existente;
  }

  const inserted = await empleadosRepository.insert({
    dni: dniLimpio,
    codigo_empleado: null,
    nombre_completo: nombre_completo.trim(),
    puesto: puesto && puesto.trim() ? puesto.trim() : null,
    regimen: regimen && regimen.trim() ? regimen.trim() : 'FT',
    celular: celular && celular.trim() ? celular.trim() : null,
    correo_asesor: correo_asesor && correo_asesor.trim() ? correo_asesor.trim() : null,
    id_tienda: tienda.id_tienda
  });

  return { id_empleado: inserted?.[0]?.id_empleado, nombre_completo: nombre_completo.trim() };
}

// Alta de una tienda junto con su única cuenta (la de la encargada), en una
// sola transacción para no dejar una tienda sin cuenta si algo falla.
async function crearTiendaConCuenta(datosTienda, requestingUser) {
  const { nombre_tienda, codigo_almacen, rango_codigos, correo_tienda } = datosTienda || {};

  if (!nombre_tienda || !nombre_tienda.trim()) {
    throw new AppError('Debes indicar el nombre de la tienda.', 400);
  }

  const correo = correo_tienda && correo_tienda.trim() ? correo_tienda.trim() : null;
  if (correo) {
    if (!EMAIL_REGEX.test(correo)) {
      throw new AppError('El correo de la tienda no es válido.', 400);
    }
    const correoEnUso = await tiendasRepository.findByCorreo(correo);
    if (correoEnUso) {
      throw new AppError('Ya existe una tienda con este correo.', 400);
    }
  }

  const username = await generarUsernameUnico(nombre_tienda);
  const password = generarPassword();
  const passwordHash = bcrypt.hashSync(password, 10);

  const nuevoId = await withTransaction(async (txQuery) => {
    const tiendaInsertada = await tiendasRepository.insert({
      nombreTienda: nombre_tienda.trim(),
      codigoAlmacen: codigo_almacen && codigo_almacen.trim() ? codigo_almacen.trim() : null,
      correoTienda: correo,
      tipo: 'TIENDA',
      rangoCodigos: rango_codigos && rango_codigos.trim() ? rango_codigos.trim() : null
    }, txQuery);

    const usuarioInsertado = await usuariosRepository.insert({
      email: null,
      username,
      passwordHash,
      rol: 'TIENDA',
      idTienda: tiendaInsertada?.[0]?.id_tienda,
      idEmpleado: null
    }, txQuery);

    return usuarioInsertado?.[0]?.id_usuario;
  });

  await registrarAuditoria({
    usuarioAfectado: { id_usuario: nuevoId, email: null, username },
    accion: 'CREAR',
    detalle: `Tienda "${nombre_tienda.trim()}" creada con su cuenta.`,
    requestingUser
  });

  return {
    message: 'Tienda y su cuenta creadas exitosamente.',
    credenciales: { username, email: null, password }
  };
}

async function createUsuario({ email, rol, id_tienda, empleado, tienda: tiendaNueva }, requestingUser) {
  if (!ROLES_VALIDOS.includes(rol)) {
    throw new AppError('Rol inválido.', 400);
  }
  assertPuedeGestionar(requestingUser, rol);

  // Crear una tienda nueva y su cuenta van juntos: una tienda tiene una sola
  // cuenta, la de la encargada, así que no tiene sentido crearlas por separado.
  if (rol === 'TIENDA' && tiendaNueva) {
    return crearTiendaConCuenta(tiendaNueva, requestingUser);
  }

  const idTienda = resolveIdTiendaForRol(rol, id_tienda);

  let finalEmail = null;
  let username = null;
  let idEmpleado = null;
  let detalleAuditoria = `Cuenta creada con rol ${rol}.`;

  if (rol === 'TIENDA') {
    const tienda = await tiendasRepository.findById(idTienda);
    if (!tienda) {
      throw new AppError('Sede no encontrada.', 400);
    }

    if (tienda.tipo === 'TIENDA') {
      // Una tienda tiene una sola cuenta compartida, la de la encargada,
      // que llena el horario de todo su equipo.
      const cuentaExistente = await usuariosRepository.findCuentaDeSede(idTienda);
      if (cuentaExistente) {
        const idExistente = cuentaExistente.email || cuentaExistente.username;
        throw new AppError(`Esta tienda ya tiene su cuenta (${idExistente}). Cada tienda usa una sola cuenta.`, 400);
      }
      username = await generarUsernameUnico(tienda.nombre_tienda);
    } else {
      // Oficina y Logística: cada empleado tiene su propia cuenta, que solo
      // le sirve para registrar su horario personal.
      const emp = await resolverEmpleadoDeCuenta(empleado, tienda);
      idEmpleado = emp.id_empleado;
      username = await generarUsernameUnico(emp.nombre_completo);
      detalleAuditoria = `Cuenta personal creada para ${emp.nombre_completo} (${tienda.nombre_tienda}).`;
    }
  } else {
    if (!email || !EMAIL_REGEX.test(email.trim())) {
      throw new AppError('Debes indicar un correo electrónico válido.', 400);
    }
    finalEmail = email.trim();
    const existing = await usuariosRepository.findByEmail(finalEmail);
    if (existing) {
      throw new AppError('Ya existe un usuario con este correo.', 400);
    }
  }

  const password = generarPassword();
  const passwordHash = bcrypt.hashSync(password, 10);
  const inserted = await usuariosRepository.insert({ email: finalEmail, username, passwordHash, rol, idTienda, idEmpleado });
  const nuevoId = inserted?.[0]?.id_usuario;

  await registrarAuditoria({
    usuarioAfectado: { id_usuario: nuevoId, email: finalEmail, username },
    accion: 'CREAR',
    detalle: detalleAuditoria,
    requestingUser
  });

  return {
    message: 'Usuario creado exitosamente.',
    credenciales: { username, email: finalEmail, password }
  };
}

async function updateUsuario(id, { rol, id_tienda, email }, requestingUser) {
  const usuario = await usuariosRepository.findById(id);
  if (!usuario) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  assertPuedeGestionar(requestingUser, usuario.rol);

  const nuevoRol = rol || usuario.rol;
  if (!ROLES_VALIDOS.includes(nuevoRol)) {
    throw new AppError('Rol inválido.', 400);
  }
  assertPuedeGestionar(requestingUser, nuevoRol);

  const idTienda = resolveIdTiendaForRol(nuevoRol, id_tienda !== undefined ? id_tienda : usuario.id_tienda);

  await usuariosRepository.updateRolTienda(id, { rol: rol || null, idTienda });

  if (rol && rol !== usuario.rol) {
    await registrarAuditoria({
      usuarioAfectado: usuario,
      accion: 'EDITAR_ROL',
      detalle: `Rol: ${usuario.rol} → ${nuevoRol}.`,
      requestingUser
    });
  }

  // Editar correo solo aplica a cuentas ADMIN/SUPERVISOR (las TIENDA usan
  // username, no correo individual).
  if (email !== undefined && usuario.rol !== 'TIENDA') {
    const nuevoEmail = (email || '').trim();
    if (!EMAIL_REGEX.test(nuevoEmail)) {
      throw new AppError('Debes indicar un correo electrónico válido.', 400);
    }
    if (nuevoEmail.toLowerCase() !== (usuario.email || '').toLowerCase()) {
      const existing = await usuariosRepository.findByEmail(nuevoEmail);
      if (existing && existing.id_usuario !== id) {
        throw new AppError('Ya existe un usuario con este correo.', 400);
      }
      await usuariosRepository.updateEmail(id, nuevoEmail);
      await registrarAuditoria({
        usuarioAfectado: usuario,
        accion: 'EDITAR_CORREO',
        detalle: `Correo: ${usuario.email || '(sin correo)'} → ${nuevoEmail}.`,
        requestingUser
      });
    }
  }

  return { message: 'Usuario actualizado exitosamente.' };
}

async function resetPassword(id, newPassword, requestingUser) {
  const usuario = await usuariosRepository.findById(id);
  if (!usuario) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  assertPuedeGestionar(requestingUser, usuario.rol);
  if (!newPassword || newPassword.length < 6) {
    throw new AppError('La contraseña debe tener al menos 6 caracteres.', 400);
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await usuariosRepository.updatePasswordHash(id, passwordHash);

  await registrarAuditoria({ usuarioAfectado: usuario, accion: 'RESET_PASSWORD', detalle: null, requestingUser });

  return { message: 'Contraseña actualizada exitosamente.' };
}

async function toggleActivo(id, activo, requestingUser) {
  const usuario = await usuariosRepository.findById(id);
  if (!usuario) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  assertPuedeGestionar(requestingUser, usuario.rol);
  if (id === requestingUser.id_usuario) {
    throw new AppError('No puedes desactivar tu propia cuenta.', 400);
  }

  await usuariosRepository.setActivo(id, activo);

  await registrarAuditoria({
    usuarioAfectado: usuario,
    accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
    detalle: null,
    requestingUser
  });

  return { message: activo ? 'Usuario activado exitosamente.' : 'Usuario desactivado exitosamente.' };
}

// Eliminación definitiva: exclusiva de Admin (garantizado por el middleware
// de la ruta). Se registra en la auditoría ANTES de borrar, con el
// identificador de la cuenta ya congelado en el propio registro de log.
async function deleteUsuario(id, requestingUser) {
  const usuario = await usuariosRepository.findById(id);
  if (!usuario) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  if (id === requestingUser.id_usuario) {
    throw new AppError('No puedes eliminar tu propia cuenta.', 400);
  }

  await registrarAuditoria({
    usuarioAfectado: usuario,
    accion: 'ELIMINAR',
    detalle: `Cuenta eliminada (rol ${usuario.rol}).`,
    requestingUser
  });

  await usuariosRepository.deleteById(id);

  return { message: 'Usuario eliminado exitosamente.' };
}

async function getHistorialUsuario(id, requestingUser) {
  const usuario = await usuariosRepository.findById(id);
  if (!usuario) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  assertPuedeGestionar(requestingUser, usuario.rol);
  return auditoriaRepository.findByUsuarioAfectado(id);
}

function getAuditoriaCompleta() {
  return auditoriaRepository.findAll();
}

module.exports = {
  listUsuarios,
  createUsuario,
  updateUsuario,
  resetPassword,
  toggleActivo,
  deleteUsuario,
  getHistorialUsuario,
  getAuditoriaCompleta,
  generarPassword
};
