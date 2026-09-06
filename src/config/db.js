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
        FOREIGN KEY (id_tienda) REFERENCES tiendas(id_tienda) ON DELETE CASCADE
      );
    `);

    // Migración ligera si las columnas nuevas no existían previamente
    sqliteDb.run(`ALTER TABLE tiendas ADD COLUMN rango_codigos TEXT`, err => {});
    sqliteDb.run(`ALTER TABLE empleados ADD COLUMN celular TEXT`, err => {});
    sqliteDb.run(`ALTER TABLE empleados ADD COLUMN correo_asesor TEXT`, err => {});
    sqliteDb.run(`ALTER TABLE empleados ADD COLUMN fecha_baja TEXT`, err => {});

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

    // Verificar si existen datos
    sqliteDb.get("SELECT COUNT(*) as count FROM tiendas", (err, row) => {
      if (err) return console.error('[DB SQLite Init Error]', err);
      if (row.count === 0) {
        console.log('[DB SQLite] Poblando datos de prueba iniciales...');
        
        const defaultHash = bcrypt.hashSync('123456', 10);
        
        sqliteDb.run(`INSERT INTO tiendas (codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada, correo_encargada) VALUES
          ('ALMA31', 'JESUS MARIA', '0100-0109', 'bissujesusmaria@bissu.pe', 'María Elena Torres', 'mtorres@bissu.pe'),
          ('ALMA32', 'SAN ISIDRO', '0110-0119', 'bissusanisidro@bissu.pe', 'Carla Mendoza', 'cmendoza@bissu.pe'),
          ('ALMA33', 'MIRAFLORES', '0120-0129', 'bissumiraflores@bissu.pe', 'Lucía Fernández', 'lfernandez@bissu.pe')
        `);

        sqliteDb.run(`INSERT INTO usuarios (email, password_hash, id_tienda, rol) VALUES
          ('bissujesusmaria@bissu.pe', '${defaultHash}', 1, 'TIENDA'),
          ('bissusanisidro@bissu.pe', '${defaultHash}', 2, 'TIENDA'),
          ('admin@bissu.pe', '${defaultHash}', NULL, 'ADMIN'),
          ('supervisor@bissu.pe', '${defaultHash}', NULL, 'SUPERVISOR'),
          ('rrhh@bissu.pe', '${defaultHash}', NULL, 'RRHH')
        `);

        sqliteDb.run(`INSERT INTO empleados (dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion, fecha_baja) VALUES
          ('71234567', '0100', 'María Elena Torres', 'ENCARGADA DE TIENDA', 'FT', '987654321', 'mtorres.0100@bissu.pe', 1, 'ACTIVO', NULL),
          ('72345678', '0101', 'Ana Paula Gómez', 'ASESOR DE VENTAS', 'FT', '987654322', 'agomez.0101@bissu.pe', 1, 'ACTIVO', NULL),
          ('73456789', '0102', 'Sofía Salazar', 'ASESOR DE VENTAS', 'PT', '987654323', 'ssalazar.0102@bissu.pe', 1, 'ACTIVO', NULL),
          ('74567890', NULL, 'Camila Benítez', 'ASESOR DE VENTAS (EN PRUEBA)', 'FT', '987654324', NULL, 1, 'ACTIVO', NULL),
          ('75678901', '0103', 'Valeria Rojas', 'CAJERA', 'PT', '987654325', 'vrojas.0103@bissu.pe', 1, 'ACTIVO', NULL),
          ('78901234', '0104', 'Luciana Vega', 'ASESOR DE VENTAS', 'FT', '987654326', 'lvega.0104@bissu.pe', 1, 'INACTIVO', '2026-08-15'),
          ('76789012', '0110', 'Carla Mendoza', 'ENCARGADA DE TIENDA', 'FT', '987654327', 'cmendoza.0110@bissu.pe', 2, 'ACTIVO', NULL),
          ('77890123', '0111', 'Patricia Rivas', 'ASESOR DE VENTAS', 'FT', '987654328', 'privas.0111@bissu.pe', 2, 'ACTIVO', NULL)
        `);

        sqliteDb.run(`INSERT INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion) VALUES
          (1, '2026-08-01', 1.0, 1), (1, '2026-08-02', 1.0, 1), (1, '2026-08-03', 1.0, 1), (1, '2026-08-04', 1.0, 1), (1, '2026-08-05', 0.5, 1),
          (2, '2026-08-01', 1.0, 1), (2, '2026-08-02', 1.0, 1), (2, '2026-08-03', 0.0, 1), (2, '2026-08-04', 1.0, 1), (2, '2026-08-05', 1.0, 1),
          (3, '2026-08-01', 0.5, 1), (3, '2026-08-02', 0.5, 1), (3, '2026-08-03', 0.5, 1), (3, '2026-08-04', 0.0, 1), (3, '2026-08-05', 1.0, 1),
          (4, '2026-08-01', 1.0, 1), (4, '2026-08-02', 1.0, 1), (4, '2026-08-03', 1.0, 1), (4, '2026-08-04', 1.0, 1), (4, '2026-08-05', 1.0, 1),
          (5, '2026-08-01', 1.0, 1), (5, '2026-08-02', 0.0, 1), (5, '2026-08-03', 1.0, 1), (5, '2026-08-04', 1.0, 1), (5, '2026-08-05', 0.5, 1),
          (6, '2026-08-01', 1.0, 1), (6, '2026-08-02', 1.0, 1), (6, '2026-08-03', 1.0, 1), (6, '2026-08-15', 0.0, 1)
        `);

        console.log('[DB SQLite] Datos iniciales insertados correctamente.');
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
