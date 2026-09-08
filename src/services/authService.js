const bcrypt = require('bcryptjs');
const usuariosRepository = require('../repositories/usuariosRepository');
const AppError = require('../errors/AppError');

async function login(email, password) {
  const user = await usuariosRepository.findByEmailWithTienda(email.trim());

  if (!user) {
    throw new AppError('Credenciales inválidas. Correo no encontrado.', 401);
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    throw new AppError('Credenciales inválidas. Contraseña incorrecta.', 401);
  }

  if (!user.activo) {
    throw new AppError('Tu cuenta ha sido desactivada. Contacta a un administrador.', 403);
  }

  return {
    id_usuario: user.id_usuario,
    email: user.email,
    rol: user.rol,
    id_tienda: user.id_tienda,
    nombre_tienda: user.nombre_tienda || 'TODAS'
  };
}

module.exports = { login };
