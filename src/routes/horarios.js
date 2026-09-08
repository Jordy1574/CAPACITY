const horariosService = require('../services/horariosService');
const { authenticate } = require('../middleware/auth');
const { requireRole, ROLES_ADMIN } = require('../middleware/roles');

async function horariosRoutes(fastify, options) {

  // GET /api/horarios?mes=2026-09&id_tienda=1
  fastify.get('/api/horarios', { onRequest: [authenticate] }, async (request, reply) => {
    const data = await horariosService.getHorarioMatrix(request.user, request.query.mes, request.query.id_tienda);
    return reply.send(data);
  });

  // PUT /api/horarios/bulk-update
  fastify.put('/api/horarios/bulk-update', { onRequest: [authenticate] }, async (request, reply) => {
    const result = await horariosService.bulkUpdateHorario(request.user, request.body);
    return reply.send(result);
  });

  // POST /api/horarios/enviar - Bloquea el horario del mes para edición directa
  fastify.post('/api/horarios/enviar', { onRequest: [authenticate] }, async (request, reply) => {
    const { mes, id_tienda } = request.body || {};
    const result = await horariosService.enviarHorario(request.user, mes, id_tienda);
    return reply.send(result);
  });

  // POST /api/horarios/solicitar-permiso - La tienda pide permiso para reabrir un horario ya enviado
  fastify.post('/api/horarios/solicitar-permiso', { onRequest: [authenticate] }, async (request, reply) => {
    const { mes, motivo, id_tienda } = request.body || {};
    const result = await horariosService.solicitarPermiso(request.user, mes, motivo, id_tienda);
    return reply.send(result);
  });

  // GET /api/horarios/solicitudes?estado=PENDIENTE - Bandeja de solicitudes (Admin/Supervisor/RRHH ven todas)
  fastify.get('/api/horarios/solicitudes', { onRequest: [authenticate] }, async (request, reply) => {
    const solicitudes = await horariosService.listSolicitudes(request.user, request.query);
    return reply.send({ solicitudes });
  });

  // POST /api/horarios/solicitudes/:id/resolver - Aprobar o rechazar (reabre el periodo si se aprueba)
  fastify.post('/api/horarios/solicitudes/:id/resolver', {
    onRequest: [authenticate, requireRole(...ROLES_ADMIN)]
  }, async (request, reply) => {
    const idSolicitud = parseInt(request.params.id, 10);
    const { aprobar, comentario } = request.body || {};
    const result = await horariosService.resolverSolicitudService(request.user, idSolicitud, aprobar, comentario);
    return reply.send(result);
  });

  // PUT /api/horarios/empleados/:id/dia-descanso - Asigna el día fijo de descanso semanal de un colaborador
  fastify.put('/api/horarios/empleados/:id/dia-descanso', { onRequest: [authenticate] }, async (request, reply) => {
    const idEmpleado = parseInt(request.params.id, 10);
    const { dia_descanso } = request.body || {};
    const result = await horariosService.updateDiaDescanso(request.user, idEmpleado, dia_descanso);
    return reply.send(result);
  });
}

module.exports = horariosRoutes;
