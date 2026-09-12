const { query } = require('../config/db');

async function findByEmailWithTienda(email) {
  const sql = `
    SELECT u.id_usuario, u.email, u.username, u.password_hash, u.rol, u.id_tienda, u.id_empleado, u.activo, t.nombre_tienda
    FROM usuarios u
    LEFT JOIN tiendas t ON u.id_tienda = t.id_tienda
    WHERE LOWER(u.email) = LOWER($1)
  `;
  const rows = await query(sql, [email]);
  return rows[0] || null;
}

async function findByUsernameWithTienda(username) {
  const sql = `
    SELECT u.id_usuario, u.email, u.username, u.password_hash, u.rol, u.id_tienda, u.id_empleado, u.activo, t.nombre_tienda
    FROM usuarios u
    LEFT JOIN tiendas t ON u.id_tienda = t.id_tienda
    WHERE LOWER(u.username) = LOWER($1)
  `;
  const rows = await query(sql, [username]);
  return rows[0] || null;
}

// Login alterno para cuentas TIENDA: se ingresa el correo oficial de la
// sede (tiendas.correo_tienda) y se autentica con la cuenta compartida de
// esa sede (misma contraseña que el username, solo cambia el identificador).
async function findByTiendaCorreoWithTienda(correoTienda) {
  const sql = `
    SELECT u.id_usuario, u.email, u.username, u.password_hash, u.rol, u.id_tienda, u.id_empleado, u.activo, t.nombre_tienda
    FROM usuarios u
    JOIN tiendas t ON u.id_tienda = t.id_tienda
    WHERE LOWER(t.correo_tienda) = LOWER($1)
    ORDER BY u.activo DESC, u.id_usuario ASC
  `;
  const rows = await query(sql, [correoTienda]);
  return rows[0] || null;
}

async function findByEmail(email) {
  const rows = await query('SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
  return rows[0] || null;
}

async function findByUsername(username) {
  const rows = await query('SELECT id_usuario FROM usuarios WHERE LOWER(username) = LOWER($1)', [username]);
  return rows[0] || null;
}

function listAll() {
  return query(`
    SELECT u.id_usuario, u.email, u.username, u.rol, u.id_tienda, u.id_empleado, u.activo, t.nombre_tienda, t.tipo AS tipo_sede
    FROM usuarios u
    LEFT JOIN tiendas t ON u.id_tienda = t.id_tienda
    ORDER BY u.id_usuario ASC
  `);
}

async function findById(id) {
  const rows = await query(`
    SELECT u.id_usuario, u.email, u.username, u.rol, u.id_tienda, u.id_empleado, u.activo, t.nombre_tienda
    FROM usuarios u
    LEFT JOIN tiendas t ON u.id_tienda = t.id_tienda
    WHERE u.id_usuario = $1
  `, [id]);
  return rows[0] || null;
}

function insert({ email, username, passwordHash, rol, idTienda, idEmpleado }, exec = query) {
  return exec(
    'INSERT INTO usuarios (email, username, password_hash, rol, id_tienda, id_empleado, activo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_usuario',
    [email || null, username || null, passwordHash, rol, idTienda, idEmpleado || null, 1]
  );
}

// Cuenta compartida de una sede: la que no está ligada a un empleado
// concreto. En una tienda es la de la encargada, y solo debe haber una.
async function findCuentaDeSede(idTienda) {
  const rows = await query(
    'SELECT id_usuario, email, username FROM usuarios WHERE id_tienda = $1 AND id_empleado IS NULL',
    [idTienda]
  );
  return rows[0] || null;
}

async function findByEmpleado(idEmpleado) {
  const rows = await query('SELECT id_usuario, username FROM usuarios WHERE id_empleado = $1', [idEmpleado]);
  return rows[0] || null;
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

function updateEmail(id, email) {
  return query('UPDATE usuarios SET email = $1 WHERE id_usuario = $2', [email, id]);
}

function deleteById(id) {
  return query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);
}

module.exports = {
  findByEmailWithTienda,
  findByUsernameWithTienda,
  findByTiendaCorreoWithTienda,
  findByEmail,
  findByUsername,
  listAll,
  findById,
  insert,
  findCuentaDeSede,
  findByEmpleado,
  updateRolTienda,
  updatePasswordHash,
  setActivo,
  updateEmail,
  deleteById
};
