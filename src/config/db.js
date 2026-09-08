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
  const { Pool } = require('pg');
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

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS horario_periodos (
        id_periodo INTEGER PRIMARY KEY AUTOINCREMENT,
        id_tienda INTEGER NOT NULL,
        mes TEXT NOT NULL,
        estado TEXT NOT NULL CHECK (estado IN ('BORRADOR', 'ENVIADO')) DEFAULT 'BORRADOR',
        fecha_envio DATETIME NULL,
        usuario_envio INTEGER NULL,
        UNIQUE(id_tienda, mes),
        FOREIGN KEY (id_tienda) REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
        FOREIGN KEY (usuario_envio) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      );
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS horario_solicitudes (
        id_solicitud INTEGER PRIMARY KEY AUTOINCREMENT,
        id_tienda INTEGER NOT NULL,
        mes TEXT NOT NULL,
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
      const isSelect = /^\s*(SELECT|PRAGMA|WITH)/i.test(sql);
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

module.exports = {
  query,
  dbDriver
};
