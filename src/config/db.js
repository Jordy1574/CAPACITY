const dotenv = require('dotenv');
dotenv.config();

const { Pool, types } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.trim() === '') {
  throw new Error(
    'Falta DATABASE_URL. La aplicación requiere PostgreSQL; define la cadena de conexión en el archivo .env.'
  );
}

// Forzar que el tipo DATE (OID 1082) se devuelva como string 'YYYY-MM-DD' y no
// como Date de JavaScript, que aplicaría zona horaria y correría el día.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

console.log('[DB] Conectado a PostgreSQL mediante DATABASE_URL');

async function query(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

// Ejecuta varias escrituras dentro de una sola transacción. pool.query() puede
// tomar una conexión distinta del pool en cada llamada, así que hace falta
// reservar un client fijo para que BEGIN/COMMIT y las escrituras intermedias
// compartan la misma conexión.
async function withTransaction(fn) {
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

module.exports = {
  query,
  withTransaction
};
