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

  // GET /api/capacity/export.csv?mes=2026-09 - Descarga la matriz del mes para Excel
  fastify.get('/api/capacity/export.csv', { onRequest: [authenticate] }, async (request, reply) => {
    const { csv, nombreArchivo } = await capacityService.exportCapacityCsv(request.user, request.query.mes, request.query.id_tienda);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${nombreArchivo}"`)
      .send(csv);
  });

  // --- API de consumo (v1) ---
  // Autenticación: Authorization: Bearer <API_KEY_EXPORT>. Se sigue aceptando
  // ?api_key= por compatibilidad con las conexiones de Power Query ya armadas,
  // pero el header es el camino recomendado: la query string queda registrada
  // en logs, historial y proxies.

  // GET /api/v1/capacity/resumen?mes=2026-09[&id_tienda=] - Una fila por
  // colaborador con sus días trabajados, para liquidar bonos.
  fastify.get('/api/v1/capacity/resumen', { onRequest: [authenticateExport] }, async (request, reply) => {
    const data = await capacityService.getResumenMensual(request.query.mes, request.query.id_tienda);
    return reply.send(data);
  });

  // GET /api/v1/capacity/diario?mes=2026-09[&id_tienda=] - Detalle día por día.
  fastify.get('/api/v1/capacity/diario', { onRequest: [authenticateExport] }, async (request, reply) => {
    const filas = await capacityService.exportCapacity(request.query.mes, request.query.id_tienda);
    return reply.send({ mes: request.query.mes, generado_en: new Date().toISOString(), registros: filas });
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
