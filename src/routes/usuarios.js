const usuariosService = require('../services/usuariosService');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

async function usuariosRoutes(fastify, options) {
  const adminOnly = { onRequest: [authenticate, requireRole('ADMIN')] };
  const adminOrSupervisor = { onRequest: [authenticate, requireRole('ADMIN', 'SUPERVISOR')] };

  // GET /api/usuarios - Lista de usuarios (sin password_hash). Un Supervisor
  // solo ve cuentas de Tienda/Oficina/Logística (filtrado en el servicio).
  fastify.get('/api/usuarios', adminOrSupervisor, async (request, reply) => {
    const usuarios = await usuariosService.listUsuarios(request.user);
    return reply.send({ usuarios });
  });

  // GET /api/auditoria - Historial completo de cambios sobre cuentas (solo Admin)
  fastify.get('/api/auditoria', adminOnly, async (request, reply) => {
    const auditoria = await usuariosService.getAuditoriaCompleta();
    return reply.send({ auditoria });
  });

  // GET /api/usuarios/:id/historial - Historial de cambios de una cuenta puntual
  fastify.get('/api/usuarios/:id/historial', adminOrSupervisor, async (request, reply) => {
    const idUsuario = parseInt(request.params.id, 10);
    const historial = await usuariosService.getHistorialUsuario(idUsuario, request.user);
    return reply.send({ historial });
  });

  // POST /api/usuarios - Crear un nuevo usuario (contraseña autogenerada
  // por el servidor; para rol TIENDA el email no aplica, se genera un
  // username a partir del nombre de la tienda). Un Supervisor solo puede
  // crear cuentas TIENDA (verificado en el servicio).
  fastify.post('/api/usuarios', {
    ...adminOrSupervisor,
    schema: {
      body: {
        type: 'object',
        required: ['rol'],
        properties: {
          email: { type: 'string' },
          rol: { type: 'string', enum: ['TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN'] },
          id_tienda: {},
          // Alta de una tienda nueva junto con su única cuenta
          tienda: {
            type: 'object',
            properties: {
              nombre_tienda: { type: 'string' },
              codigo_almacen: { type: 'string' },
              rango_codigos: { type: 'string' },
              correo_tienda: { type: 'string' }
            }
          },
          // Datos personales para cuentas de Oficina/Logística (una por empleado)
          empleado: {
            type: 'object',
            properties: {
              dni: { type: 'string' },
              nombre_completo: { type: 'string' },
              puesto: { type: 'string' },
              regimen: { type: 'string' },
              celular: { type: 'string' },
              correo_asesor: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const result = await usuariosService.createUsuario(request.body, request.user);
    return reply.send(result);
  });

  // PUT /api/usuarios/:id - Editar rol / tienda asignada, y correo (solo
  // aplica a cuentas ADMIN/SUPERVISOR)
  fastify.put('/api/usuarios/:id', {
    ...adminOrSupervisor,
    schema: {
      body: {
        type: 'object',
        properties: {
          rol: { type: 'string', enum: ['TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN'] },
          id_tienda: {},
          email: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const idUsuario = parseInt(request.params.id, 10);
    const result = await usuariosService.updateUsuario(idUsuario, request.body || {}, request.user);
    return reply.send(result);
  });

  // POST /api/usuarios/:id/reset-password - Restablecer contraseña
  fastify.post('/api/usuarios/:id/reset-password', {
    ...adminOrSupervisor,
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
    const result = await usuariosService.resetPassword(idUsuario, request.body.password, request.user);
    return reply.send(result);
  });

  // POST /api/usuarios/:id/toggle-activo - Activar / desactivar usuario
  fastify.post('/api/usuarios/:id/toggle-activo', {
    ...adminOrSupervisor,
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

  // DELETE /api/usuarios/:id - Eliminación definitiva (exclusivo Admin)
  fastify.delete('/api/usuarios/:id', adminOnly, async (request, reply) => {
    const idUsuario = parseInt(request.params.id, 10);
    const result = await usuariosService.deleteUsuario(idUsuario, request.user);
    return reply.send(result);
  });
}

module.exports = usuariosRoutes;
