const bcrypt = require('bcryptjs');
const usuariosRepository = require('../repositories/usuariosRepository');
const AppError = require('../errors/AppError');

const ROLES_VALIDOS = ['TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function listUsuarios() {
  return usuariosRepository.listAll();
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

async function createUsuario({ email, password, rol, id_tienda }) {
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    throw new AppError('Debes indicar un correo electrónico válido.', 400);
  }
  if (!password || password.length < 6) {
    throw new AppError('La contraseña debe tener al menos 6 caracteres.', 400);
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    throw new AppError('Rol inválido.', 400);
  }

  const idTienda = resolveIdTiendaForRol(rol, id_tienda);

  const existing = await usuariosRepository.findByEmail(email.trim());
  if (existing) {
    throw new AppError('Ya existe un usuario con este correo.', 400);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  await usuariosRepository.insert({ email: email.trim(), passwordHash, rol, idTienda });

  return { message: 'Usuario creado exitosamente.' };
}

async function updateUsuario(id, { rol, id_tienda }) {
  const usuario = await usuariosRepository.findById(id);
  if (!usuario) {
    throw new AppError('Usuario no encontrado.', 404);
  }

  const nuevoRol = rol || usuario.rol;
  if (!ROLES_VALIDOS.includes(nuevoRol)) {
    throw new AppError('Rol inválido.', 400);
  }

  const idTienda = resolveIdTiendaForRol(nuevoRol, id_tienda !== undefined ? id_tienda : usuario.id_tienda);

  await usuariosRepository.updateRolTienda(id, { rol: rol || null, idTienda });

  return { message: 'Usuario actualizado exitosamente.' };
}

async function resetPassword(id, newPassword) {
  const usuario = await usuariosRepository.findById(id);
  if (!usuario) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  if (!newPassword || newPassword.length < 6) {
    throw new AppError('La contraseña debe tener al menos 6 caracteres.', 400);
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await usuariosRepository.updatePasswordHash(id, passwordHash);

  return { message: 'Contraseña actualizada exitosamente.' };
}

async function toggleActivo(id, activo, requestingUser) {
  const usuario = await usuariosRepository.findById(id);
  if (!usuario) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  if (id === requestingUser.id_usuario) {
    throw new AppError('No puedes desactivar tu propia cuenta.', 400);
  }

  await usuariosRepository.setActivo(id, activo);

  return { message: activo ? 'Usuario activado exitosamente.' : 'Usuario desactivado exitosamente.' };
}

module.exports = { listUsuarios, createUsuario, updateUsuario, resetPassword, toggleActivo };
