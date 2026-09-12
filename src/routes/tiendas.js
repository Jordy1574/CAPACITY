const tiendasService = require('../services/tiendasService');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

async function tiendasRoutes(fastify, options) {
  const adminOnly = { onRequest: [authenticate, requireRole('ADMIN')] };

  // POST /api/tiendas - Crear una nueva sede (correo opcional)
  fastify.post('/api/tiendas', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        required: ['nombre_tienda', 'tipo'],
        properties: {
          nombre_tienda: { type: 'string' },
          tipo: { type: 'string', enum: ['TIENDA', 'OFICINA', 'LOGISTICA'] },
          codigo_almacen: { type: 'string' },
          correo_tienda: { type: 'string' },
          rango_codigos: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const result = await tiendasService.createTienda(request.body);
    return reply.send(result);
  });

  // PUT /api/tiendas/:id - Editar una sede existente
  fastify.put('/api/tiendas/:id', adminOnly, async (request, reply) => {
    const idTienda = parseInt(request.params.id, 10);
    const result = await tiendasService.updateTienda(idTienda, request.body || {});
    return reply.send(result);
  });
}

module.exports = tiendasRoutes;
