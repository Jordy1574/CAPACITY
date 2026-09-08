const horariosService = require('../services/horariosService');
const { authenticate } = require('../middleware/auth');
const { requireRole, ROLES_ADMIN } = require('../middleware/roles');

async function horariosRoutes(fastify, options) {

  // GET /api/horarios/semana?semana_inicio=2026-08-31&id_tienda=1
  fastify.get('/api/horarios/semana', { onRequest: [authenticate] }, async (request, reply) => {
    const data = await horariosService.getHorarioSemana(request.user, request.query.semana_inicio, request.query.id_tienda);
    return reply.send(data);
  });

  // PUT /api/horarios/bulk-update - Edición en vivo (bloqueada para TIENDA una vez confirmada como oficial)
  fastify.put('/api/horarios/bulk-update', { onRequest: [authenticate] }, async (request, reply) => {
    const result = await horariosService.bulkUpdateHorario(request.user, request.body);
    return reply.send(result);
  });

  // POST /api/horarios/solicitudes - Crea/reemplaza la solicitud de cambio pendiente de una tienda+semana
  fastify.post('/api/horarios/solicitudes', { onRequest: [authenticate] }, async (request, reply) => {
    const { semana_inicio, id_tienda, motivo, cambios } = request.body || {};
    const result = await horariosService.crearSolicitud(request.user, semana_inicio, id_tienda, motivo, cambios);
    return reply.send(result);
  });

  // GET /api/horarios/solicitudes?estado=PENDIENTE - Bandeja de solicitudes (Admin/Supervisor/RRHH ven todas)
  fastify.get('/api/horarios/solicitudes', { onRequest: [authenticate] }, async (request, reply) => {
    const solicitudes = await horariosService.listSolicitudes(request.user, request.query);
    return reply.send({ solicitudes });
  });

  // POST /api/horarios/solicitudes/:id/resolver - Aprobar (aplica los turnos y confirma oficial) o rechazar
  fastify.post('/api/horarios/solicitudes/:id/resolver', {
    onRequest: [authenticate, requireRole(...ROLES_ADMIN)]
  }, async (request, reply) => {
    const idSolicitud = parseInt(request.params.id, 10);
    const { aprobar, comentario, cambios } = request.body || {};
    const result = await horariosService.resolverSolicitudService(request.user, idSolicitud, aprobar, comentario, cambios);
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
