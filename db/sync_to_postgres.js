const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log('No DATABASE_URL found in .env, skipping PostgreSQL sync.');
  process.exit(0);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const dbPath = path.join(__dirname, 'capacity.db');
const sqliteDb = new sqlite3.Database(dbPath);

async function syncToPg() {
  console.log('[PG SYNC] Starting synchronization from capacity.db to PostgreSQL...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Helper to safely get rows if a table exists in SQLite
    async function getRowsSafe(tableName, orderBy = '') {
      const exists = await new Promise((res, rej) => {
        sqliteDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [tableName], (err, row) => {
          if (err) rej(err);
          else res(!!row);
        });
      });
      if (!exists) {
        console.log(`  [INFO] Tabla SQLite '${tableName}' no existe, omitiendo datos.`);
        return [];
      }
      const sql = orderBy ? `SELECT * FROM ${tableName} ORDER BY ${orderBy}` : `SELECT * FROM ${tableName}`;
      return new Promise((res, rej) => {
        sqliteDb.all(sql, (err, rows) => err ? rej(err) : res(rows));
      });
    }

    // 1. Re-create PostgreSQL Schema
    await client.query(`
      DROP TABLE IF EXISTS horario_solicitud_turnos CASCADE;
      DROP TABLE IF EXISTS horario_solicitud_dias CASCADE;
      DROP TABLE IF EXISTS horario_solicitudes CASCADE;
      DROP TABLE IF EXISTS horario_semanas CASCADE;
      DROP TABLE IF EXISTS horario_periodos CASCADE;
      DROP TABLE IF EXISTS horario_turnos CASCADE;
      DROP TABLE IF EXISTS horarios_diario CASCADE;
      DROP TABLE IF EXISTS capacity_diario CASCADE;
      DROP TABLE IF EXISTS empleados CASCADE;
      DROP TABLE IF EXISTS usuarios CASCADE;
      DROP TABLE IF EXISTS tiendas CASCADE;

      CREATE TABLE tiendas (
          id_tienda SERIAL PRIMARY KEY,
          codigo_almacen VARCHAR(20),
          nombre_tienda VARCHAR(100) NOT NULL,
          rango_codigos VARCHAR(50),
          correo_tienda VARCHAR(150) UNIQUE NOT NULL,
          encargada VARCHAR(150),
          correo_encargada VARCHAR(150)
      );

      CREATE TABLE usuarios (
          id_usuario SERIAL PRIMARY KEY,
          email VARCHAR(150) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          id_tienda INT NULL REFERENCES tiendas(id_tienda) ON DELETE SET NULL,
          rol VARCHAR(20) CHECK (rol IN ('TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN')) DEFAULT 'TIENDA',
          activo BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE empleados (
          id_empleado SERIAL PRIMARY KEY,
          dni VARCHAR(50) UNIQUE NOT NULL,
          codigo_empleado VARCHAR(20) NULL,
          nombre_completo VARCHAR(150) NOT NULL,
          puesto VARCHAR(100),
          regimen VARCHAR(10),
          celular VARCHAR(20) NULL,
          correo_asesor VARCHAR(150) NULL,
          id_tienda INT NOT NULL REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
          situacion VARCHAR(20) DEFAULT 'ACTIVO',
          fecha_baja DATE NULL,
          dia_descanso VARCHAR(20) NULL
      );

      CREATE TABLE capacity_diario (
          id_registro SERIAL PRIMARY KEY,
          id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          valor NUMERIC(3,2) NOT NULL DEFAULT 0.0,
          usuario_modificacion INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
          fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_empleado_fecha UNIQUE(id_empleado, fecha)
      );

      CREATE TABLE horarios_diario (
          id_registro SERIAL PRIMARY KEY,
          id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          valor NUMERIC(3,2) NOT NULL DEFAULT 0.0,
          usuario_modificacion INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
          fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_empleado_fecha_horario UNIQUE(id_empleado, fecha)
      );

      CREATE TABLE horario_turnos (
          id_turno SERIAL PRIMARY KEY,
          id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          hora_inicio VARCHAR(5) NOT NULL,
          hora_fin VARCHAR(5) NOT NULL,
          usuario_modificacion INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
          fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_horario_turnos_empleado_fecha ON horario_turnos(id_empleado, fecha);

      CREATE TABLE horario_semanas (
          id_semana SERIAL PRIMARY KEY,
          id_tienda INT NOT NULL REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
          semana_inicio DATE NOT NULL,
          confirmado_por INT NULL REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
          fecha_confirmacion TIMESTAMP NULL,
          CONSTRAINT unique_tienda_semana UNIQUE(id_tienda, semana_inicio)
      );

      CREATE TABLE horario_solicitudes (
          id_solicitud SERIAL PRIMARY KEY,
          id_tienda INT NOT NULL REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
          semana_inicio DATE NOT NULL,
          motivo TEXT NOT NULL,
          estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')) DEFAULT 'PENDIENTE',
          solicitado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
          fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resuelto_por INT NULL REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
          fecha_resolucion TIMESTAMP NULL,
          comentario_resolucion TEXT NULL
      );

      CREATE TABLE horario_solicitud_dias (
          id_solicitud INT NOT NULL REFERENCES horario_solicitudes(id_solicitud) ON DELETE CASCADE,
          id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          PRIMARY KEY (id_solicitud, id_empleado, fecha)
      );

      CREATE TABLE horario_solicitud_turnos (
          id_solicitud INT NOT NULL REFERENCES horario_solicitudes(id_solicitud) ON DELETE CASCADE,
          id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          hora_inicio VARCHAR(5) NOT NULL,
          hora_fin VARCHAR(5) NOT NULL
      );
      CREATE INDEX idx_horario_solicitud_turnos ON horario_solicitud_turnos(id_solicitud, id_empleado, fecha);
    `);

    // 2. Read and Insert Tiendas
    const stores = await getRowsSafe("tiendas", "id_tienda ASC");
    for (const s of stores) {
      await client.query(`
        INSERT INTO tiendas (id_tienda, codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada, correo_encargada)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [s.id_tienda, s.codigo_almacen, s.nombre_tienda, s.rango_codigos, s.correo_tienda, s.encargada, s.correo_encargada]);
    }
    if (stores.length > 0) {
      await client.query(`SELECT setval('tiendas_id_tienda_seq', (SELECT MAX(id_tienda) FROM tiendas))`);
    }

    // 3. Read and Insert Usuarios
    const users = await getRowsSafe("usuarios", "id_usuario ASC");
    for (const u of users) {
      const activoVal = u.activo !== undefined ? (u.activo === 1 || u.activo === true) : true;
      await client.query(`
        INSERT INTO usuarios (id_usuario, email, password_hash, id_tienda, rol, activo)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [u.id_usuario, u.email, u.password_hash, u.id_tienda, u.rol, activoVal]);
    }
    if (users.length > 0) {
      await client.query(`SELECT setval('usuarios_id_usuario_seq', (SELECT MAX(id_usuario) FROM usuarios))`);
    }

    // 4. Read and Insert Empleados
    const emps = await getRowsSafe("empleados", "id_empleado ASC");
    for (const e of emps) {
      await client.query(`
        INSERT INTO empleados (id_empleado, dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion, fecha_baja, dia_descanso)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [e.id_empleado, e.dni, e.codigo_empleado, e.nombre_completo, e.puesto, e.regimen, e.celular, e.correo_asesor, e.id_tienda, e.situacion, e.fecha_baja || null, e.dia_descanso || null]);
    }
    if (emps.length > 0) {
      await client.query(`SELECT setval('empleados_id_empleado_seq', (SELECT MAX(id_empleado) FROM empleados))`);
    }

    // 5. Read and Insert Capacity Diario
    const records = await getRowsSafe("capacity_diario", "id_registro ASC");
    for (const rec of records) {
      await client.query(`
        INSERT INTO capacity_diario (id_registro, id_empleado, fecha, valor, usuario_modificacion)
        VALUES ($1, $2, $3, $4, $5)
      `, [rec.id_registro, rec.id_empleado, rec.fecha, rec.valor, rec.usuario_modificacion]);
    }
    if (records.length > 0) {
      await client.query(`SELECT setval('capacity_diario_id_registro_seq', (SELECT MAX(id_registro) FROM capacity_diario))`);
    }

    // 6. Read and Insert Horarios Diario
    const horarios = await getRowsSafe("horarios_diario", "id_registro ASC");
    for (const h of horarios) {
      await client.query(`
        INSERT INTO horarios_diario (id_registro, id_empleado, fecha, valor, usuario_modificacion)
        VALUES ($1, $2, $3, $4, $5)
      `, [h.id_registro, h.id_empleado, h.fecha, h.valor, h.usuario_modificacion]);
    }
    if (horarios.length > 0) {
      await client.query(`SELECT setval('horarios_diario_id_registro_seq', (SELECT MAX(id_registro) FROM horarios_diario))`);
    }

    // 6b. Read and Insert Horario Turnos
    const turnos = await getRowsSafe("horario_turnos", "id_turno ASC");
    for (const t of turnos) {
      await client.query(`
        INSERT INTO horario_turnos (id_turno, id_empleado, fecha, hora_inicio, hora_fin, usuario_modificacion)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [t.id_turno, t.id_empleado, t.fecha, t.hora_inicio, t.hora_fin, t.usuario_modificacion]);
    }
    if (turnos.length > 0) {
      await client.query(`SELECT setval('horario_turnos_id_turno_seq', (SELECT MAX(id_turno) FROM horario_turnos))`);
    }

    // 7. Read and Insert Horario Semanas (Reemplazo moderno de horario_periodos)
    const semanas = await getRowsSafe("horario_semanas", "id_semana ASC");
    for (const sm of semanas) {
      await client.query(`
        INSERT INTO horario_semanas (id_semana, id_tienda, semana_inicio, confirmado_por, fecha_confirmacion)
        VALUES ($1, $2, $3, $4, $5)
      `, [sm.id_semana, sm.id_tienda, sm.semana_inicio, sm.confirmado_por, sm.fecha_confirmacion]);
    }
    if (semanas.length > 0) {
      await client.query(`SELECT setval('horario_semanas_id_semana_seq', (SELECT MAX(id_semana) FROM horario_semanas))`);
    }

    // 8. Read and Insert Horario Solicitudes
    const solicitudes = await getRowsSafe("horario_solicitudes", "id_solicitud ASC");
    for (const s of solicitudes) {
      if (s.semana_inicio) {
        await client.query(`
          INSERT INTO horario_solicitudes (id_solicitud, id_tienda, semana_inicio, motivo, estado, solicitado_por, fecha_solicitud, resuelto_por, fecha_resolucion, comentario_resolucion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [s.id_solicitud, s.id_tienda, s.semana_inicio, s.motivo, s.estado, s.solicitado_por, s.fecha_solicitud, s.resuelto_por, s.fecha_resolucion, s.comentario_resolucion]);
      }
    }
    if (solicitudes.length > 0) {
      await client.query(`SELECT setval('horario_solicitudes_id_solicitud_seq', (SELECT MAX(id_solicitud) FROM horario_solicitudes))`);
    }

    // 9. Read and Insert Solicitud Días y Turnos
    const solicitudDias = await getRowsSafe("horario_solicitud_dias");
    for (const sd of solicitudDias) {
      await client.query(`
        INSERT INTO horario_solicitud_dias (id_solicitud, id_empleado, fecha)
        VALUES ($1, $2, $3)
      `, [sd.id_solicitud, sd.id_empleado, sd.fecha]);
    }

    const solicitudTurnos = await getRowsSafe("horario_solicitud_turnos");
    for (const st of solicitudTurnos) {
      await client.query(`
        INSERT INTO horario_solicitud_turnos (id_solicitud, id_empleado, fecha, hora_inicio, hora_fin)
        VALUES ($1, $2, $3, $4, $5)
      `, [st.id_solicitud, st.id_empleado, st.fecha, st.hora_inicio, st.hora_fin]);
    }

    await client.query('COMMIT');

    console.log('[PG SYNC] Successfully synced all data to PostgreSQL!');
    console.log(`  - Tiendas: ${stores.length}`);
    console.log(`  - Usuarios: ${users.length}`);
    console.log(`  - Empleados: ${emps.length}`);
    console.log(`  - Registros Asistencia: ${records.length}`);
    console.log(`  - Registros Horarios (legado): ${horarios.length}`);
    console.log(`  - Turnos de Horario: ${turnos.length}`);
    console.log(`  - Semanas de Horario: ${semanas.length}`);
    console.log(`  - Solicitudes de Horario: ${solicitudes.length}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PG SYNC ERROR]', err);
  } finally {
    client.release();
    pool.end();
    sqliteDb.close();
  }
}

syncToPg();
