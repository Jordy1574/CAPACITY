const tiendasRepository = require('../repositories/tiendasRepository');
const capacityService = require('../services/capacityService');
const { authenticate, authenticateExport, API_KEY_EXPORT } = require('../middleware/auth');

async function capacityRoutes(fastify, options) {

  // GET /api/tiendas - Lista de tiendas para selectores
  fastify.get('/api/tiendas', { onRequest: [authenticate] }, async (request, reply) => {
    const tiendas = await tiendasRepository.listAll();
    return reply.send({ tiendas });
  });

  // GET /api/capacity?mes=2026-08&id_tienda=1
  fastify.get('/api/capacity', { onRequest: [authenticate] }, async (request, reply) => {
    const data = await capacityService.getCapacityMatrix(request.user, request.query.mes, request.query.id_tienda);
    return reply.send(data);
  });

  // POST /api/empleados - Agregar nuevo colaborador
  fastify.post('/api/empleados', {
    onRequest: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['dni', 'nombre_completo'],
        properties: {
          dni: { type: 'string' },
          nombre_completo: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const result = await capacityService.createEmpleado(request.user, request.body);
    return reply.send(result);
  });

  // PUT /api/empleados/:id - Editar colaborador (código de asesor, celular, retiro/baja, etc.)
  fastify.put('/api/empleados/:id', { onRequest: [authenticate] }, async (request, reply) => {
    const idEmpleado = parseInt(request.params.id, 10);
    const result = await capacityService.updateEmpleado(request.user, idEmpleado, request.body);
    return reply.send(result);
  });

  // PUT /api/capacity/bulk-update
  fastify.put('/api/capacity/bulk-update', { onRequest: [authenticate] }, async (request, reply) => {
    const result = await capacityService.bulkUpdateCapacity(request.user, request.body);
    return reply.send(result);
  });

  // GET /api/capacity/export?mes=2026-08 (Para Power Query / Power BI)
  fastify.get('/api/capacity/export', { onRequest: [authenticateExport] }, async (request, reply) => {
    const exportData = await capacityService.exportCapacity(request.query.mes, request.query.id_tienda);
    return reply.send(exportData);
  });

  // GET /api/capacity/export-url?mes=2026-08 - arma la URL de exportación sin
  // exponer la API key en el bundle del cliente.
  fastify.get('/api/capacity/export-url', { onRequest: [authenticate] }, async (request, reply) => {
    const { mes } = request.query;
    const url = `${request.protocol}://${request.hostname}/api/capacity/export?mes=${mes}&api_key=${API_KEY_EXPORT}`;
    return reply.send({ url });
  });
}

module.exports = capacityRoutes;
