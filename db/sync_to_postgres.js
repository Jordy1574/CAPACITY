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

    // 1. Re-create PostgreSQL Schema
    await client.query(`
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
          rol VARCHAR(20) CHECK (rol IN ('TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN')) DEFAULT 'TIENDA'
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
          fecha_baja DATE NULL
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
    `);

    // 2. Read and Insert Tiendas
    const stores = await new Promise((res, rej) => sqliteDb.all("SELECT * FROM tiendas ORDER BY id_tienda ASC", (e, r) => e ? rej(e) : res(r)));
    for (const s of stores) {
      await client.query(`
        INSERT INTO tiendas (id_tienda, codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada, correo_encargada)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [s.id_tienda, s.codigo_almacen, s.nombre_tienda, s.rango_codigos, s.correo_tienda, s.encargada, s.correo_encargada]);
    }
    await client.query(`SELECT setval('tiendas_id_tienda_seq', (SELECT MAX(id_tienda) FROM tiendas))`);

    // 3. Read and Insert Usuarios
    const users = await new Promise((res, rej) => sqliteDb.all("SELECT * FROM usuarios ORDER BY id_usuario ASC", (e, r) => e ? rej(e) : res(r)));
    for (const u of users) {
      await client.query(`
        INSERT INTO usuarios (id_usuario, email, password_hash, id_tienda, rol)
        VALUES ($1, $2, $3, $4, $5)
      `, [u.id_usuario, u.email, u.password_hash, u.id_tienda, u.rol]);
    }
    await client.query(`SELECT setval('usuarios_id_usuario_seq', (SELECT MAX(id_usuario) FROM usuarios))`);

    // 4. Read and Insert Empleados
    const emps = await new Promise((res, rej) => sqliteDb.all("SELECT * FROM empleados ORDER BY id_empleado ASC", (e, r) => e ? rej(e) : res(r)));
    for (const e of emps) {
      await client.query(`
        INSERT INTO empleados (id_empleado, dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion, fecha_baja)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [e.id_empleado, e.dni, e.codigo_empleado, e.nombre_completo, e.puesto, e.regimen, e.celular, e.correo_asesor, e.id_tienda, e.situacion, e.fecha_baja || null]);
    }
    await client.query(`SELECT setval('empleados_id_empleado_seq', (SELECT MAX(id_empleado) FROM empleados))`);

    // 5. Read and Insert Capacity Diario
    const records = await new Promise((res, rej) => sqliteDb.all("SELECT * FROM capacity_diario ORDER BY id_registro ASC", (e, r) => e ? rej(e) : res(r)));
    for (const rec of records) {
      await client.query(`
        INSERT INTO capacity_diario (id_registro, id_empleado, fecha, valor, usuario_modificacion)
        VALUES ($1, $2, $3, $4, $5)
      `, [rec.id_registro, rec.id_empleado, rec.fecha, rec.valor, rec.usuario_modificacion]);
    }
    await client.query(`SELECT setval('capacity_diario_id_registro_seq', (SELECT MAX(id_registro) FROM capacity_diario))`);

    await client.query('COMMIT');

    console.log('[PG SYNC] Successfully synced all data to PostgreSQL!');
    console.log(`  - Tiendas: ${stores.length}`);
    console.log(`  - Usuarios: ${users.length}`);
    console.log(`  - Empleados: ${emps.length}`);
    console.log(`  - Registros Asistencia: ${records.length}`);

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
