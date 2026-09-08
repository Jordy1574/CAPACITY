const { query } = require('../config/db');

async function findByEmailWithTienda(email) {
  const sql = `
    SELECT u.id_usuario, u.email, u.password_hash, u.rol, u.id_tienda, u.activo, t.nombre_tienda
    FROM usuarios u
    LEFT JOIN tiendas t ON u.id_tienda = t.id_tienda
    WHERE LOWER(u.email) = LOWER($1)
  `;
  const rows = await query(sql, [email]);
  return rows[0] || null;
}

async function findByEmail(email) {
  const rows = await query('SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
  return rows[0] || null;
}

function listAll() {
  return query(`
    SELECT u.id_usuario, u.email, u.rol, u.id_tienda, u.activo, t.nombre_tienda
    FROM usuarios u
    LEFT JOIN tiendas t ON u.id_tienda = t.id_tienda
    ORDER BY u.id_usuario ASC
  `);
}

async function findById(id) {
  const rows = await query(`
    SELECT u.id_usuario, u.email, u.rol, u.id_tienda, u.activo, t.nombre_tienda
    FROM usuarios u
    LEFT JOIN tiendas t ON u.id_tienda = t.id_tienda
    WHERE u.id_usuario = $1
  `, [id]);
  return rows[0] || null;
}

function insert({ email, passwordHash, rol, idTienda }) {
  return query(
    'INSERT INTO usuarios (email, password_hash, rol, id_tienda, activo) VALUES ($1, $2, $3, $4, 1)',
    [email, passwordHash, rol, idTienda]
  );
}

function updateRolTienda(id, { rol, idTienda }) {
  return query(
    'UPDATE usuarios SET rol = COALESCE($1, rol), id_tienda = $2 WHERE id_usuario = $3',
    [rol, idTienda, id]
  );
}

function updatePasswordHash(id, passwordHash) {
  return query('UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2', [passwordHash, id]);
}

function setActivo(id, activo) {
  return query('UPDATE usuarios SET activo = $1 WHERE id_usuario = $2', [activo ? 1 : 0, id]);
}

module.exports = {
  findByEmailWithTienda,
  findByEmail,
  listAll,
  findById,
  insert,
  updateRolTienda,
  updatePasswordHash,
  setActivo
};
