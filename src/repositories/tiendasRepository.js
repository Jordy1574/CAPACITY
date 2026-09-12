const { query } = require('../config/db');

function listAll() {
  return query(`
    SELECT id_tienda, codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada, tipo
    FROM tiendas
    ORDER BY
      CASE tipo WHEN 'TIENDA' THEN 0 WHEN 'OFICINA' THEN 1 WHEN 'LOGISTICA' THEN 2 ELSE 3 END,
      CASE WHEN tipo = 'TIENDA' THEN CAST(SUBSTR(codigo_almacen, 5) AS INTEGER) ELSE 0 END,
      nombre_tienda ASC
  `);
}

async function findById(idTienda) {
  const rows = await query('SELECT * FROM tiendas WHERE id_tienda = $1', [idTienda]);
  return rows[0] || null;
}

async function findByCorreo(correo) {
  const rows = await query('SELECT * FROM tiendas WHERE LOWER(correo_tienda) = LOWER($1)', [correo]);
  return rows[0] || null;
}

function insert({ nombreTienda, codigoAlmacen, correoTienda, tipo, rangoCodigos }, exec = query) {
  return exec(
    'INSERT INTO tiendas (nombre_tienda, codigo_almacen, correo_tienda, tipo, rango_codigos) VALUES ($1, $2, $3, $4, $5) RETURNING id_tienda',
    [nombreTienda, codigoAlmacen || null, correoTienda || null, tipo, rangoCodigos || null]
  );
}

function update(id, { nombreTienda, codigoAlmacen, correoTienda, rangoCodigos }) {
  return query(
    'UPDATE tiendas SET nombre_tienda = $1, codigo_almacen = $2, correo_tienda = $3, rango_codigos = $4 WHERE id_tienda = $5',
    [nombreTienda, codigoAlmacen || null, correoTienda || null, rangoCodigos || null, id]
  );
}

module.exports = { listAll, findById, findByCorreo, insert, update };
