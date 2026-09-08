const usuariosService = require('../services/usuariosService');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

async function usuariosRoutes(fastify, options) {
  const adminOnly = { onRequest: [authenticate, requireRole('ADMIN')] };

  // GET /api/usuarios - Lista de usuarios (sin password_hash)
  fastify.get('/api/usuarios', adminOnly, async (request, reply) => {
    const usuarios = await usuariosService.listUsuarios();
    return reply.send({ usuarios });
  });

  // POST /api/usuarios - Crear un nuevo usuario
  fastify.post('/api/usuarios', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'rol'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string', minLength: 6 },
          rol: { type: 'string', enum: ['TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN'] },
          id_tienda: {}
        }
      }
    }
  }, async (request, reply) => {
    const result = await usuariosService.createUsuario(request.body);
    return reply.send(result);
  });

  // PUT /api/usuarios/:id - Editar rol / tienda asignada
  fastify.put('/api/usuarios/:id', adminOnly, async (request, reply) => {
    const idUsuario = parseInt(request.params.id, 10);
    const result = await usuariosService.updateUsuario(idUsuario, request.body || {});
    return reply.send(result);
  });

  // POST /api/usuarios/:id/reset-password - Restablecer contraseña
  fastify.post('/api/usuarios/:id/reset-password', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const idUsuario = parseInt(request.params.id, 10);
    const result = await usuariosService.resetPassword(idUsuario, request.body.password);
    return reply.send(result);
  });

  // POST /api/usuarios/:id/toggle-activo - Activar / desactivar usuario
  fastify.post('/api/usuarios/:id/toggle-activo', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        required: ['activo'],
        properties: {
          activo: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const idUsuario = parseInt(request.params.id, 10);
    const result = await usuariosService.toggleActivo(idUsuario, request.body.activo, request.user);
    return reply.send(result);
  });
}

module.exports = usuariosRoutes;
