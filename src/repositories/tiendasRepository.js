const { query } = require('../config/db');

function listAll() {
  return query('SELECT id_tienda, codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada FROM tiendas ORDER BY id_tienda ASC');
}

async function findById(idTienda) {
  const rows = await query('SELECT * FROM tiendas WHERE id_tienda = $1', [idTienda]);
  return rows[0] || null;
}

module.exports = { listAll, findById };
