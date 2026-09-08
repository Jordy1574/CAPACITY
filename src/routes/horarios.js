const { query, dbDriver } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { getDaysInMonth } = require('../utils/dates');
const { getActiveEmpleados } = require('../utils/empleados');

const ROLES_ADMIN = ['ADMIN', 'SUPERVISOR', 'RRHH'];

async function getPeriodo(idTienda, mes) {
  const rows = await query('SELECT * FROM horario_periodos WHERE id_tienda = $1 AND mes = $2', [idTienda, mes]);
  return rows[0] || { id_tienda: idTienda, mes, estado: 'BORRADOR', fecha_envio: null, usuario_envio: null };
}

async function getSolicitudPendiente(idTienda, mes) {
  const rows = await query(
    "SELECT * FROM horario_solicitudes WHERE id_tienda = $1 AND mes = $2 AND estado = 'PENDIENTE' ORDER BY fecha_solicitud DESC",
    [idTienda, mes]
  );
  return rows[0] || null;
}

async function horariosRoutes(fastify, options) {

  // GET /api/horarios?mes=2026-09&id_tienda=1
  fastify.get('/api/horarios', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      let mes = request.query.mes;
      if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
        mes = '2026-09';
      }
      const firstDayOfMonth = `${mes}-01`;

      let idTienda = user.id_tienda;
      if (ROLES_ADMIN.includes(user.rol)) {
        if (request.query.id_tienda) {
          idTienda = parseInt(request.query.id_tienda, 10);
        } else if (!idTienda) {
          idTienda = 1;
        }
      }

      if (!idTienda) {
        return reply.status(400).send({ error: 'Debes especificar el ID de tienda.' });
      }

      const tiendas = await query('SELECT * FROM tiendas WHERE id_tienda = $1', [idTienda]);
      if (!tiendas || tiendas.length === 0) {
        return reply.status(404).send({ error: 'Tienda no encontrada.' });
      }
      const tienda = tiendas[0];

      const empleados = await getActiveEmpleados(idTienda, firstDayOfMonth);
      const daysInMonth = getDaysInMonth(mes);
      const periodo = await getPeriodo(idTienda, mes);
      const solicitudPendiente = await getSolicitudPendiente(idTienda, mes);

      if (empleados.length === 0) {
        return reply.send({
          tienda,
          mes,
          dias_mes: daysInMonth,
          empleados: [],
          periodo,
          solicitud_pendiente: solicitudPendiente
        });
      }

      const empIds = empleados.map(e => e.id_empleado);
      const placeholders = empIds.map((_, i) => `$${i + 2}`).join(',');
      const sql = `
        SELECT id_registro, id_empleado, CAST(fecha AS TEXT) AS fecha, valor
        FROM horarios_diario
        WHERE id_empleado IN (${placeholders}) AND CAST(fecha AS TEXT) LIKE $1
      `;
      const horarioRecords = await query(sql, [`${mes}%`, ...empIds]);

      const horarioMap = {};
      horarioRecords.forEach(rec => {
        if (!horarioMap[rec.id_empleado]) horarioMap[rec.id_empleado] = {};
        horarioMap[rec.id_empleado][String(rec.fecha).substring(0, 10)] = parseFloat(rec.valor);
      });

      const empleadosConDias = empleados.map(emp => {
        const diasObj = {};
        daysInMonth.forEach(dayStr => {
          diasObj[dayStr] = horarioMap[emp.id_empleado]?.[dayStr] ?? null;
        });
        return { ...emp, dias: diasObj };
      });

      return reply.send({
        tienda,
        mes,
        dias_mes: daysInMonth,
        empleados: empleadosConDias,
        periodo,
        solicitud_pendiente: solicitudPendiente
      });

    } catch (err) {
      console.error('[GET HORARIOS ERROR]', err);
      return reply.status(500).send({ error: 'Error al consultar el horario.' });
    }
  });

  // PUT /api/horarios/bulk-update
  fastify.put('/api/horarios/bulk-update', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      let cambios = request.body;
      if (cambios && cambios.cambios) cambios = cambios.cambios;

      if (!Array.isArray(cambios) || cambios.length === 0) {
        return reply.status(400).send({ error: 'Formato de cambios inválido. Se espera un array de registros.' });
      }

      const empIdsToUpdate = [...new Set(cambios.map(c => c.id_empleado))];
      const placeholders = empIdsToUpdate.map((_, i) => `$${i + 1}`).join(',');
      const checkSql = `SELECT id_empleado, id_tienda FROM empleados WHERE id_empleado IN (${placeholders})`;
      const checkedEmps = await query(checkSql, empIdsToUpdate);
      const tiendaByEmp = {};
      checkedEmps.forEach(e => { tiendaByEmp[e.id_empleado] = e.id_tienda; });

      if (user.rol === 'TIENDA') {
        const invalidEmp = checkedEmps.find(e => e.id_tienda !== user.id_tienda);
        if (invalidEmp || checkedEmps.length !== empIdsToUpdate.length) {
          return reply.status(403).send({ error: 'Acceso denegado: Intento no autorizado de editar empleados de otra sede.' });
        }

        // El horario enviado se bloquea para TIENDA hasta que se otorgue permiso de modificación.
        const mesesTienda = [...new Set(cambios.map(c => String(c.fecha).substring(0, 7)))];
        for (const mes of mesesTienda) {
          const periodo = await getPeriodo(user.id_tienda, mes);
          if (periodo.estado === 'ENVIADO') {
            return reply.status(403).send({
              error: `El horario de ${mes} ya fue enviado. Solicita permiso a Supervisor/RRHH/Admin para poder modificarlo.`
            });
          }
        }
      }

      let updatedCount = 0;
      for (const cambio of cambios) {
        const { id_empleado, fecha, valor } = cambio;
        if (!id_empleado || !fecha || valor === undefined) continue;

        if (valor === null) {
          const deleteSql = `DELETE FROM horarios_diario WHERE id_empleado = $1 AND CAST(fecha AS TEXT) LIKE $2`;
          await query(deleteSql, [id_empleado, `${fecha}%`]);
          updatedCount++;
          continue;
        }

        const numericValor = parseFloat(valor);

        if (dbDriver === 'pg') {
          const upsertPg = `
            INSERT INTO horarios_diario (id_empleado, fecha, valor, usuario_modificacion, fecha_actualizacion)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (id_empleado, fecha)
            DO UPDATE SET valor = EXCLUDED.valor, usuario_modificacion = EXCLUDED.usuario_modificacion, fecha_actualizacion = NOW()
          `;
          await query(upsertPg, [id_empleado, fecha, numericValor, user.id_usuario]);
        } else {
          const upsertSqlite = `
            INSERT INTO horarios_diario (id_empleado, fecha, valor, usuario_modificacion, fecha_actualizacion)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (id_empleado, fecha)
            DO UPDATE SET valor = EXCLUDED.valor, usuario_modificacion = EXCLUDED.usuario_modificacion, fecha_actualizacion = CURRENT_TIMESTAMP
          `;
          await query(upsertSqlite, [id_empleado, fecha, numericValor, user.id_usuario]);
        }
        updatedCount++;
      }

      return reply.send({
        message: 'Horario actualizado correctamente.',
        registros_actualizados: updatedCount
      });

    } catch (err) {
      console.error('[HORARIO BULK UPDATE ERROR]', err);
      return reply.status(500).send({ error: 'Error al guardar los cambios de horario.' });
    }
  });

  // POST /api/horarios/enviar - Bloquea el horario del mes para edición directa
  fastify.post('/api/horarios/enviar', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      const { mes } = request.body || {};

      if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
        return reply.status(400).send({ error: 'Debes indicar un mes válido (YYYY-MM).' });
      }

      let idTienda = user.id_tienda;
      if (ROLES_ADMIN.includes(user.rol)) {
        if (!request.body.id_tienda) {
          return reply.status(400).send({ error: 'Debes especificar el ID de tienda.' });
        }
        idTienda = parseInt(request.body.id_tienda, 10);
      }

      const periodo = await getPeriodo(idTienda, mes);
      if (user.rol === 'TIENDA' && periodo.estado === 'ENVIADO') {
        return reply.status(400).send({ error: 'El horario ya fue enviado. Solicita permiso si necesitas modificarlo.' });
      }

      if (periodo.id_periodo) {
        await query(
          "UPDATE horario_periodos SET estado = 'ENVIADO', fecha_envio = CURRENT_TIMESTAMP, usuario_envio = $1 WHERE id_periodo = $2",
          [user.id_usuario, periodo.id_periodo]
        );
      } else {
        await query(
          "INSERT INTO horario_periodos (id_tienda, mes, estado, fecha_envio, usuario_envio) VALUES ($1, $2, 'ENVIADO', CURRENT_TIMESTAMP, $3)",
          [idTienda, mes, user.id_usuario]
        );
      }

      return reply.send({ message: 'Horario enviado correctamente. Ya no se puede editar salvo que se otorgue permiso.' });

    } catch (err) {
      console.error('[ENVIAR HORARIO ERROR]', err);
      return reply.status(500).send({ error: 'Error al enviar el horario.' });
    }
  });

  // POST /api/horarios/solicitar-permiso - La tienda pide permiso para reabrir un horario ya enviado
  fastify.post('/api/horarios/solicitar-permiso', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      const { mes, motivo } = request.body || {};

      if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
        return reply.status(400).send({ error: 'Debes indicar un mes válido (YYYY-MM).' });
      }
      if (!motivo || !motivo.trim()) {
        return reply.status(400).send({ error: 'Debes indicar el motivo de la solicitud.' });
      }

      let idTienda = user.id_tienda;
      if (ROLES_ADMIN.includes(user.rol)) {
        if (!request.body.id_tienda) {
          return reply.status(400).send({ error: 'Debes especificar el ID de tienda.' });
        }
        idTienda = parseInt(request.body.id_tienda, 10);
      }

      const periodo = await getPeriodo(idTienda, mes);
      if (periodo.estado !== 'ENVIADO') {
        return reply.status(400).send({ error: 'Este horario no está enviado, no requiere permiso para modificarse.' });
      }

      const existente = await getSolicitudPendiente(idTienda, mes);
      if (existente) {
        return reply.status(400).send({ error: 'Ya existe una solicitud pendiente para este periodo.' });
      }

      await query(
        "INSERT INTO horario_solicitudes (id_tienda, mes, motivo, estado, solicitado_por) VALUES ($1, $2, $3, 'PENDIENTE', $4)",
        [idTienda, mes, motivo.trim(), user.id_usuario]
      );

      return reply.send({ message: 'Solicitud de permiso enviada. Se te notificará cuando sea revisada.' });

    } catch (err) {
      console.error('[SOLICITAR PERMISO ERROR]', err);
      return reply.status(500).send({ error: 'Error al enviar la solicitud de permiso.' });
    }
  });

  // GET /api/horarios/solicitudes?estado=PENDIENTE - Bandeja de solicitudes (Admin/Supervisor/RRHH ven todas)
  fastify.get('/api/horarios/solicitudes', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      const estado = request.query.estado;

      let sql = `
        SELECT
          s.id_solicitud, s.id_tienda, s.mes, s.motivo, s.estado,
          s.fecha_solicitud, s.fecha_resolucion, s.comentario_resolucion,
          t.nombre_tienda, t.codigo_almacen,
          us.email AS solicitado_por_email,
          ur.email AS resuelto_por_email
        FROM horario_solicitudes s
        INNER JOIN tiendas t ON t.id_tienda = s.id_tienda
        LEFT JOIN usuarios us ON us.id_usuario = s.solicitado_por
        LEFT JOIN usuarios ur ON ur.id_usuario = s.resuelto_por
        WHERE 1=1
      `;
      const params = [];

      if (user.rol === 'TIENDA') {
        params.push(user.id_tienda);
        sql += ` AND s.id_tienda = $${params.length}`;
      } else if (request.query.id_tienda) {
        params.push(parseInt(request.query.id_tienda, 10));
        sql += ` AND s.id_tienda = $${params.length}`;
      }

      if (estado) {
        params.push(estado);
        sql += ` AND s.estado = $${params.length}`;
      }

      sql += ` ORDER BY s.fecha_solicitud DESC`;

      const solicitudes = await query(sql, params);
      return reply.send({ solicitudes });

    } catch (err) {
      console.error('[GET SOLICITUDES ERROR]', err);
      return reply.status(500).send({ error: 'Error al consultar las solicitudes.' });
    }
  });

  // POST /api/horarios/solicitudes/:id/resolver - Aprobar o rechazar (reabre el periodo si se aprueba)
  fastify.post('/api/horarios/solicitudes/:id/resolver', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      if (!ROLES_ADMIN.includes(user.rol)) {
        return reply.status(403).send({ error: 'Acceso denegado: solo Supervisor, RRHH o Admin pueden resolver solicitudes.' });
      }

      const idSolicitud = parseInt(request.params.id, 10);
      const { aprobar, comentario } = request.body || {};

      const rows = await query('SELECT * FROM horario_solicitudes WHERE id_solicitud = $1', [idSolicitud]);
      if (!rows || rows.length === 0) {
        return reply.status(404).send({ error: 'Solicitud no encontrada.' });
      }
      const solicitud = rows[0];
      if (solicitud.estado !== 'PENDIENTE') {
        return reply.status(400).send({ error: 'Esta solicitud ya fue resuelta anteriormente.' });
      }

      const nuevoEstado = aprobar ? 'APROBADA' : 'RECHAZADA';
      await query(
        `UPDATE horario_solicitudes
         SET estado = $1, resuelto_por = $2, fecha_resolucion = CURRENT_TIMESTAMP, comentario_resolucion = $3
         WHERE id_solicitud = $4`,
        [nuevoEstado, user.id_usuario, comentario || null, idSolicitud]
      );

      if (aprobar) {
        await query(
          "UPDATE horario_periodos SET estado = 'BORRADOR' WHERE id_tienda = $1 AND mes = $2",
          [solicitud.id_tienda, solicitud.mes]
        );
      }

      return reply.send({
        message: aprobar
          ? 'Solicitud aprobada. La tienda ya puede modificar su horario.'
          : 'Solicitud rechazada.'
      });

    } catch (err) {
      console.error('[RESOLVER SOLICITUD ERROR]', err);
      return reply.status(500).send({ error: 'Error al resolver la solicitud.' });
    }
  });
}

module.exports = horariosRoutes;
