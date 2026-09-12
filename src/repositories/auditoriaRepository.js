const { query } = require('../config/db');

function registrar({ idUsuarioAfectado, identificadorAfectado, accion, detalle, idUsuarioActor, actorIdentificador }) {
  return query(
    `INSERT INTO usuarios_auditoria
      (id_usuario_afectado, identificador_afectado, accion, detalle, id_usuario_actor, actor_identificador)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [idUsuarioAfectado || null, identificadorAfectado, accion, detalle || null, idUsuarioActor || null, actorIdentificador]
  );
}

function findByUsuarioAfectado(idUsuario) {
  return query(
    `SELECT id_auditoria, id_usuario_afectado, identificador_afectado, accion, detalle, id_usuario_actor, actor_identificador, fecha
     FROM usuarios_auditoria
     WHERE id_usuario_afectado = $1
     ORDER BY fecha DESC`,
    [idUsuario]
  );
}

function findAll(limit = 300) {
  return query(
    `SELECT id_auditoria, id_usuario_afectado, identificador_afectado, accion, detalle, id_usuario_actor, actor_identificador, fecha
     FROM usuarios_auditoria
     ORDER BY fecha DESC
     LIMIT $1`,
    [limit]
  );
}

module.exports = { registrar, findByUsuarioAfectado, findAll };
