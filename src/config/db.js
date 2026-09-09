const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let dbDriver = null; // 'pg' or 'sqlite'
let pool = null;
let sqliteDb = null;

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl && databaseUrl.trim() !== '') {
  const { Pool, types } = require('pg');
  // Forzar que el tipo DATE (OID 1082) se devuelva como string 'YYYY-MM-DD', igual que SQLite
  types.setTypeParser(1082, (val) => val);

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  dbDriver = 'pg';
  console.log('[DB] Conectado a PostgreSQL mediante DATABASE_URL');
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbDir = path.join(__dirname, '../../db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'capacity.db');
  sqliteDb = new sqlite3.Database(dbPath);
  dbDriver = 'sqlite';
  console.log(`[DB] Conectado a SQLite embebido en: ${dbPath}`);
  
  // Inicialización y migración automática de esquema y seed en SQLite
  initSqliteSchemaAndSeed();
}

function initSqliteSchemaAndSeed() {
  sqliteDb.serialize(() => {
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS tiendas (
        id_tienda INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo_almacen TEXT,
        nombre_tienda TEXT NOT NULL,
        rango_codigos TEXT,
        correo_tienda TEXT UNIQUE NOT NULL,
        encargada TEXT,
        correo_encargada TEXT
      );
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        id_tienda INTEGER NULL,
        rol TEXT CHECK (rol IN ('TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN')) DEFAULT 'TIENDA',
        activo INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (id_tienda) REFERENCES tiendas(id_tienda) ON DELETE SET NULL
      );
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS empleados (
        id_empleado INTEGER PRIMARY KEY AUTOINCREMENT,
        dni TEXT UNIQUE NOT NULL,
        codigo_empleado TEXT,
        nombre_completo TEXT NOT NULL,
        puesto TEXT,
        regimen TEXT,
        celular TEXT,
        correo_asesor TEXT,
        id_tienda INTEGER NOT NULL,
        situacion TEXT DEFAULT 'ACTIVO',
        fecha_baja TEXT,
        dia_descanso TEXT,
        FOREIGN KEY (id_tienda) REFERENCES tiendas(id_tienda) ON DELETE CASCADE
      );
    `);

    // Migración ligera si las columnas nuevas no existían previamente
    sqliteDb.run(`ALTER TABLE tiendas ADD COLUMN rango_codigos TEXT`, err => {});
    sqliteDb.run(`ALTER TABLE empleados ADD COLUMN celular TEXT`, err => {});
    sqliteDb.run(`ALTER TABLE empleados ADD COLUMN correo_asesor TEXT`, err => {});
    sqliteDb.run(`ALTER TABLE empleados ADD COLUMN fecha_baja TEXT`, err => {});
    sqliteDb.run(`ALTER TABLE empleados ADD COLUMN dia_descanso TEXT`, err => {});
    sqliteDb.run(`ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1`, err => {});

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS capacity_diario (
        id_registro INTEGER PRIMARY KEY AUTOINCREMENT,
        id_empleado INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        valor REAL NOT NULL DEFAULT 0.0,
        usuario_modificacion INTEGER,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id_empleado, fecha),
        FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE CASCADE,
        FOREIGN KEY (usuario_modificacion) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      );
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS horarios_diario (
        id_registro INTEGER PRIMARY KEY AUTOINCREMENT,
        id_empleado INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        valor REAL NOT NULL DEFAULT 0.0,
        usuario_modificacion INTEGER,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id_empleado, fecha),
        FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE CASCADE,
        FOREIGN KEY (usuario_modificacion) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      );
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS horario_turnos (
        id_turno INTEGER PRIMARY KEY AUTOINCREMENT,
        id_empleado INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        usuario_modificacion INTEGER,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE CASCADE,
        FOREIGN KEY (usuario_modificacion) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      );
    `);
    sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_horario_turnos_empleado_fecha ON horario_turnos(id_empleado, fecha)`);

    // Reemplaza a la antigua horario_periodos (mensual): el estado de
    // aprobación es ahora por semana, no por mes.
    sqliteDb.run(`DROP TABLE IF EXISTS horario_periodos`);
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS horario_semanas (
        id_semana INTEGER PRIMARY KEY AUTOINCREMENT,
        id_tienda INTEGER NOT NULL,
        semana_inicio TEXT NOT NULL,
        confirmado_por INTEGER NULL,
        fecha_confirmacion DATETIME NULL,
        UNIQUE(id_tienda, semana_inicio),
        FOREIGN KEY (id_tienda) REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
        FOREIGN KEY (confirmado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      );
    `);

    // horario_solicitudes cambia de forma (de mensual+solo-motivo a
    // semanal+con-turnos-propuestos): si existe con el esquema viejo (columna
    // "mes"), se recrea desde cero — son datos de prueba locales.
    sqliteDb.all(`PRAGMA table_info(horario_solicitudes)`, (err, cols) => {
      const esquemaViejo = !err && Array.isArray(cols) && cols.some(c => c.name === 'mes');
      if (esquemaViejo) {
        sqliteDb.run(`DROP TABLE IF EXISTS horario_solicitudes`);
      }
      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS horario_solicitudes (
          id_solicitud INTEGER PRIMARY KEY AUTOINCREMENT,
          id_tienda INTEGER NOT NULL,
          semana_inicio TEXT NOT NULL,
          motivo TEXT NOT NULL,
          estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')) DEFAULT 'PENDIENTE',
          solicitado_por INTEGER,
          fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
          resuelto_por INTEGER NULL,
          fecha_resolucion DATETIME NULL,
          comentario_resolucion TEXT NULL,
          FOREIGN KEY (id_tienda) REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
          FOREIGN KEY (solicitado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
          FOREIGN KEY (resuelto_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
        );
      `);
    });

    // Días (empleado+fecha) que una solicitud modifica respecto al oficial.
    // Su ausencia = sin cambios ese día; 0 filas en horario_solicitud_turnos
    // para ese día = se propone dejarlo sin turnos.
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS horario_solicitud_dias (
        id_solicitud INTEGER NOT NULL,
        id_empleado INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        PRIMARY KEY (id_solicitud, id_empleado, fecha),
        FOREIGN KEY (id_solicitud) REFERENCES horario_solicitudes(id_solicitud) ON DELETE CASCADE,
        FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE CASCADE
      );
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS horario_solicitud_turnos (
        id_solicitud INTEGER NOT NULL,
        id_empleado INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        FOREIGN KEY (id_solicitud) REFERENCES horario_solicitudes(id_solicitud) ON DELETE CASCADE,
        FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE CASCADE
      );
    `);
    sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_horario_solicitud_turnos ON horario_solicitud_turnos(id_solicitud, id_empleado, fecha)`);

    // Verificar si existen datos
    sqliteDb.get("SELECT COUNT(*) as count FROM tiendas", (err, row) => {
      if (err) return console.error('[DB SQLite Init Error]', err);
      if (!row || row.count === 0) {
        console.log('[DB SQLite] Cargas vacías detectadas. Ejecutando importación de datos reales desde Excel...');
        try {
          const { execSync } = require('child_process');
          const pyScript = path.join(__dirname, '../../db/import_real_data.py');
          execSync(`python "${pyScript}"`, { stdio: 'inherit' });
        } catch (e) {
          console.error('[DB SQLite] Error al importar datos reales:', e);
        }
      }
    });
  });
}

async function query(sql, params = []) {
  if (dbDriver === 'pg') {
    const res = await pool.query(sql, params);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      const sqliteSql = sql.replace(/\$(\d+)/g, '?');
      // Un INSERT/UPDATE con RETURNING produce filas igual que un SELECT.
      const isSelect = /^\s*(SELECT|PRAGMA|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql);
      if (isSelect) {
        sqliteDb.all(sqliteSql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      } else {
        sqliteDb.run(sqliteSql, params, function(err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      }
    });
  }
}

// Ejecuta varias escrituras dentro de una sola transacción. En SQLite hay
// una única conexión compartida para todo el proceso, así que las llamadas
// secuenciales a query() ya se ejecutan en orden sobre ella — BEGIN/COMMIT
// alcanzan. En Postgres, pool.query() puede tomar una conexión distinta del
// pool en cada llamada, así que hace falta reservar un client fijo para que
// BEGIN/COMMIT y las escrituras intermedias compartan la misma conexión.
async function withTransaction(fn) {
  if (dbDriver === 'pg') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txQuery = async (sql, params = []) => (await client.query(sql, params)).rows;
      const result = await fn(txQuery);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  await query('BEGIN');
  try {
    const result = await fn(query);
    await query('COMMIT');
    return result;
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}

module.exports = {
  query,
  withTransaction,
  dbDriver
};
