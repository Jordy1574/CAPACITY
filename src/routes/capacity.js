const { query, dbDriver } = require('../config/db');
const { authenticate, authenticateExport } = require('../middleware/auth');
const { getDaysInMonth } = require('../utils/dates');
const { getActiveEmpleados } = require('../utils/empleados');

async function capacityRoutes(fastify, options) {
  
  // GET /api/tiendas - Lista de tiendas para selectores
  fastify.get('/api/tiendas', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const tiendas = await query('SELECT id_tienda, codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada FROM tiendas ORDER BY id_tienda ASC');
      return reply.send({ tiendas });
    } catch (err) {
      console.error('[GET TIENDAS ERROR]', err);
      return reply.status(500).send({ error: 'Error al obtener la lista de tiendas.' });
    }
  });

  // GET /api/capacity?mes=2026-08&id_tienda=1
  fastify.get('/api/capacity', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      let mes = request.query.mes;
      
      if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
        mes = '2026-08';
      }

      const firstDayOfMonth = `${mes}-01`;

      // ROW-LEVEL SECURITY (RLS):
      let idTienda = user.id_tienda;
      if (['ADMIN', 'SUPERVISOR', 'RRHH'].includes(user.rol)) {
        if (request.query.id_tienda) {
          idTienda = parseInt(request.query.id_tienda, 10);
        } else if (!idTienda) {
          idTienda = 1;
        }
      }

      if (!idTienda) {
        return reply.status(400).send({ error: 'Debes especificar el ID de tienda.' });
      }

      // Obtener datos de la tienda
      const tiendas = await query('SELECT * FROM tiendas WHERE id_tienda = $1', [idTienda]);
      if (!tiendas || tiendas.length === 0) {
        return reply.status(404).send({ error: 'Tienda no encontrada.' });
      }
      const tienda = tiendas[0];

      // GESTIÓN DE ALTA ROTACIÓN Y FILTRADO POR MES:
      const empleados = await getActiveEmpleados(idTienda, firstDayOfMonth);

      if (empleados.length === 0) {
        return reply.send({
          tienda,
          mes,
          dias_mes: getDaysInMonth(mes),
          empleados: [],
          resumen: {
            total_empleados: 0,
            promedio_capacity: 0,
            asistencias_completas: 0,
            dias_trabajados: 0
          }
        });
      }

      const empIds = empleados.map(e => e.id_empleado);
      
      const placeholders = empIds.map((_, i) => `$${i + 2}`).join(',');
      const fullSql = `
        SELECT id_registro, id_empleado, CAST(fecha AS TEXT) AS fecha, valor
        FROM capacity_diario
        WHERE id_empleado IN (${placeholders}) AND CAST(fecha AS TEXT) LIKE $1
      `;

      const searchPattern = `${mes}%`;
      const capacityRecords = await query(fullSql, [searchPattern, ...empIds]);

      // Mapear registros por id_empleado y fecha
      const capacityMap = {};
      let totalValor = 0;
      let asistenciasCompletasCount = 0;
      let totalDiasConRegistro = 0;

      capacityRecords.forEach(rec => {
        if (!capacityMap[rec.id_empleado]) {
          capacityMap[rec.id_empleado] = {};
        }
        const val = parseFloat(rec.valor);
        const fechaKey = String(rec.fecha).substring(0, 10);
        capacityMap[rec.id_empleado][fechaKey] = val;
        
        totalValor += val;
        if (val === 1.0) asistenciasCompletasCount++;
        if (val > 0) totalDiasConRegistro++;
      });

      const daysInMonth = getDaysInMonth(mes);
      const empleadosConDias = empleados.map(emp => {
        const diasObj = {};
        daysInMonth.forEach(dayStr => {
          diasObj[dayStr] = capacityMap[emp.id_empleado]?.[dayStr] ?? null;
        });
        return {
          ...emp,
          dias: diasObj
        };
      });

      const totalPosible = empleados.filter(e => e.situacion === 'ACTIVO').length * daysInMonth.length;
      const promedioCapacity = totalPosible > 0 ? parseFloat(((totalValor / totalPosible) * 100).toFixed(1)) : 0;

      return reply.send({
        tienda,
        mes,
        dias_mes: daysInMonth,
        empleados: empleadosConDias,
        resumen: {
          total_empleados: empleados.length,
          promedio_capacity: promedioCapacity,
          asistencias_completas: asistenciasCompletasCount,
          dias_trabajados: totalDiasConRegistro
        }
      });

    } catch (err) {
      console.error('[GET CAPACITY ERROR]', err);
      return reply.status(500).send({ error: 'Error al consultar la matriz de capacity.' });
    }
  });

  // POST /api/empleados - Agregar nuevo colaborador
  fastify.post('/api/empleados', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      const { dni, nombre_completo, puesto, regimen, celular, correo_asesor, codigo_empleado, id_tienda } = request.body || {};

      if (!dni || !nombre_completo) {
        return reply.status(400).send({ error: 'Debes proporcionar al menos DNI y Nombre Completo.' });
      }

      let targetTiendaId = user.id_tienda;
      if (['ADMIN', 'SUPERVISOR', 'RRHH'].includes(user.rol) && id_tienda) {
        targetTiendaId = parseInt(id_tienda, 10);
      }

      if (!targetTiendaId) {
        return reply.status(400).send({ error: 'ID de tienda inválido.' });
      }

      // Validar DNI único
      const existing = await query('SELECT id_empleado FROM empleados WHERE dni = $1', [dni.trim()]);
      if (existing && existing.length > 0) {
        return reply.status(400).send({ error: 'Ya existe un colaborador registrado con este DNI.' });
      }

      const insertSql = `
        INSERT INTO empleados (dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVO')
      `;

      const cleanCodigo = codigo_empleado && codigo_empleado.trim() !== '' ? codigo_empleado.trim() : null;
      const cleanCorreo = correo_asesor && correo_asesor.trim() !== '' ? correo_asesor.trim() : null;
      const cleanCelular = celular && celular.trim() !== '' ? celular.trim() : null;

      await query(insertSql, [
        dni.trim(),
        cleanCodigo,
        nombre_completo.trim(),
        puesto || 'ASESOR DE VENTAS',
        regimen || 'FT',
        cleanCelular,
        cleanCorreo,
        targetTiendaId
      ]);

      return reply.send({ message: 'Colaborador registrado exitosamente.' });

    } catch (err) {
      console.error('[CREATE EMPLEADO ERROR]', err);
      return reply.status(500).send({ error: 'Error al registrar colaborador.' });
    }
  });

  // PUT /api/empleados/:id - Editar colaborador (código de asesor, celular, retiro/baja, etc.)
  fastify.put('/api/empleados/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      const idEmpleado = parseInt(request.params.id, 10);
      const { dni, nombre_completo, puesto, regimen, celular, correo_asesor, codigo_empleado, situacion, fecha_baja } = request.body || {};

      // RLS Check
      const checkEmp = await query('SELECT id_empleado, id_tienda FROM empleados WHERE id_empleado = $1', [idEmpleado]);
      if (!checkEmp || checkEmp.length === 0) {
        return reply.status(404).send({ error: 'Colaborador no encontrado.' });
      }

      if (user.rol === 'TIENDA' && checkEmp[0].id_tienda !== user.id_tienda) {
        return reply.status(403).send({ error: 'Acceso denegado: Intento no autorizado de editar colaborador de otra sede.' });
      }

      const cleanCodigo = codigo_empleado && codigo_empleado.trim() !== '' ? codigo_empleado.trim() : null;
      const cleanCorreo = correo_asesor && correo_asesor.trim() !== '' ? correo_asesor.trim() : null;
      const cleanCelular = celular && celular.trim() !== '' ? celular.trim() : null;
      const cleanFechaBaja = situacion === 'INACTIVO' ? (fecha_baja || new Date().toISOString().substring(0, 10)) : null;

      const updateSql = `
        UPDATE empleados
        SET dni = COALESCE($1, dni),
            nombre_completo = COALESCE($2, nombre_completo),
            puesto = COALESCE($3, puesto),
            regimen = COALESCE($4, regimen),
            celular = $5,
            correo_asesor = $6,
            codigo_empleado = $7,
            situacion = COALESCE($8, situacion),
            fecha_baja = $9
        WHERE id_empleado = $10
      `;

      await query(updateSql, [
        dni ? dni.trim() : null,
        nombre_completo ? nombre_completo.trim() : null,
        puesto || null,
        regimen || null,
        cleanCelular,
        cleanCorreo,
        cleanCodigo,
        situacion || null,
        cleanFechaBaja,
        idEmpleado
      ]);

      return reply.send({ message: 'Datos del colaborador actualizados exitosamente.' });

    } catch (err) {
      console.error('[UPDATE EMPLEADO ERROR]', err);
      return reply.status(500).send({ error: 'Error al actualizar colaborador.' });
    }
  });

  // PUT /api/capacity/bulk-update
  fastify.put('/api/capacity/bulk-update', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      let cambios = request.body;
      if (cambios && cambios.cambios) cambios = cambios.cambios;

      if (!Array.isArray(cambios) || cambios.length === 0) {
        return reply.status(400).send({ error: 'Formato de cambios inválido. Se espera un array de registros.' });
      }

      if (user.rol === 'TIENDA') {
        const empIdsToUpdate = [...new Set(cambios.map(c => c.id_empleado))];
        const placeholders = empIdsToUpdate.map((_, i) => `$${i + 1}`).join(',');
        const checkSql = `SELECT id_empleado, id_tienda FROM empleados WHERE id_empleado IN (${placeholders})`;
        const checkedEmps = await query(checkSql, empIdsToUpdate);

        const invalidEmp = checkedEmps.find(e => e.id_tienda !== user.id_tienda);
        if (invalidEmp || checkedEmps.length !== empIdsToUpdate.length) {
          return reply.status(403).send({ error: 'Acceso denegado: Intento no autorizado de editar empleados de otra sede.' });
        }
      }

      let updatedCount = 0;
      for (const cambio of cambios) {
        const { id_empleado, fecha, valor } = cambio;
        if (!id_empleado || !fecha || valor === undefined) continue;

        if (valor === null) {
          const deleteSql = `DELETE FROM capacity_diario WHERE id_empleado = $1 AND CAST(fecha AS TEXT) LIKE $2`;
          await query(deleteSql, [id_empleado, `${fecha}%`]);
          updatedCount++;
          continue;
        }

        const numericValor = parseFloat(valor);

        if (dbDriver === 'pg') {
          const upsertPg = `
            INSERT INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion, fecha_actualizacion)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (id_empleado, fecha) 
            DO UPDATE SET valor = EXCLUDED.valor, usuario_modificacion = EXCLUDED.usuario_modificacion, fecha_actualizacion = NOW()
          `;
          await query(upsertPg, [id_empleado, fecha, numericValor, user.id_usuario]);
        } else {
          const upsertSqlite = `
            INSERT INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion, fecha_actualizacion)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (id_empleado, fecha) 
            DO UPDATE SET valor = EXCLUDED.valor, usuario_modificacion = EXCLUDED.usuario_modificacion, fecha_actualizacion = CURRENT_TIMESTAMP
          `;
          await query(upsertSqlite, [id_empleado, fecha, numericValor, user.id_usuario]);
        }
        updatedCount++;
      }

      return reply.send({
        message: 'Registros de capacity actualizados correctamente.',
        registros_actualizados: updatedCount
      });

    } catch (err) {
      console.error('[BULK UPDATE ERROR]', err);
      return reply.status(500).send({ error: 'Error al guardar los cambios de capacity.' });
    }
  });

  // GET /api/capacity/export?mes=2026-08 (Para Power Query / Power BI)
  fastify.get('/api/capacity/export', { onRequest: [authenticateExport] }, async (request, reply) => {
    try {
      let mes = request.query.mes || '2026-08';
      let idTienda = request.query.id_tienda ? parseInt(request.query.id_tienda, 10) : null;

      let sql = `
        SELECT 
          CAST(c.fecha AS TEXT) AS fecha,
          e.dni,
          e.codigo_empleado,
          e.nombre_completo AS nombre_empleado,
          e.puesto,
          e.regimen,
          e.celular,
          e.correo_asesor,
          t.codigo_almacen,
          t.nombre_tienda,
          c.valor
        FROM capacity_diario c
        INNER JOIN empleados e ON c.id_empleado = e.id_empleado
        INNER JOIN tiendas t ON e.id_tienda = t.id_tienda
        WHERE CAST(c.fecha AS TEXT) LIKE $1
      `;
      const params = [`${mes}%`];

      if (idTienda) {
        sql += ` AND e.id_tienda = $2`;
        params.push(idTienda);
      }

      sql += ` ORDER BY t.nombre_tienda ASC, e.nombre_completo ASC, c.fecha ASC`;

      const rows = await query(sql, params);

      const exportData = rows.map(r => ({
        fecha: String(r.fecha).substring(0, 10),
        dni: r.dni,
        codigo_empleado: r.codigo_empleado || 'EN PRUEBA',
        nombre_empleado: r.nombre_empleado,
        puesto: r.puesto,
        regimen: r.regimen,
        celular: r.celular || '',
        correo_asesor: r.correo_asesor || '',
        codigo_almacen: r.codigo_almacen,
        nombre_tienda: r.nombre_tienda,
        valor: parseFloat(r.valor)
      }));

      return reply.send(exportData);

    } catch (err) {
      console.error('[EXPORT ERROR]', err);
      return reply.status(500).send({ error: 'Error al exportar datos para Power Query.' });
    }
  });
}

module.exports = capacityRoutes;
