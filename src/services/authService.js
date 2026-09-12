const bcrypt = require('bcryptjs');
const usuariosRepository = require('../repositories/usuariosRepository');
const AppError = require('../errors/AppError');

// El campo de login acepta indistintamente: correo personal (ADMIN/SUPERVISOR),
// username autogenerado (TIENDA/OFICINA/LOGISTICA), o el correo oficial de la
// sede (tiendas.correo_tienda) como alias de la cuenta compartida de esa sede.
async function login(identificador, password) {
  const valor = identificador.trim();

  let user = await usuariosRepository.findByEmailWithTienda(valor);
  if (!user) {
    user = await usuariosRepository.findByUsernameWithTienda(valor);
  }
  if (!user) {
    user = await usuariosRepository.findByTiendaCorreoWithTienda(valor);
  }

  if (!user) {
    throw new AppError('Credenciales inválidas. Usuario no encontrado.', 401);
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
    username: user.username,
    rol: user.rol,
    id_tienda: user.id_tienda,
    // Presente solo en cuentas personales (Oficina/Logística): limita al
    // usuario a registrar únicamente su propio horario.
    id_empleado: user.id_empleado || null,
    nombre_tienda: user.nombre_tienda || 'TODAS'
  };
}

module.exports = { login };
