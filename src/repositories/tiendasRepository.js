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

module.exports = { listAll, findById };
