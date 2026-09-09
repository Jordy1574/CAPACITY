const { query } = require('../config/db');

function listAll() {
  return query(
    'SELECT id_tienda, codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada FROM tiendas ORDER BY CAST(SUBSTR(codigo_almacen, 5) AS INTEGER) ASC'
  );
}

async function findById(idTienda) {
  const rows = await query('SELECT * FROM tiendas WHERE id_tienda = $1', [idTienda]);
  return rows[0] || null;
}

module.exports = { listAll, findById };
