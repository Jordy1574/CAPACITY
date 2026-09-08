const AppError = require('../errors/AppError');

const ROLES_ADMIN = ['ADMIN', 'SUPERVISOR', 'RRHH'];

function requireRole(...allowedRoles) {
  return async function (request, reply) {
    if (!request.user || !allowedRoles.includes(request.user.rol)) {
      throw new AppError('Acceso denegado: rol insuficiente.', 403);
    }
  };
}

module.exports = { ROLES_ADMIN, requireRole };
