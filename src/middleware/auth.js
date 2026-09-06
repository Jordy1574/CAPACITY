const dotenv = require('dotenv');
dotenv.config();

const API_KEY_EXPORT = process.env.API_KEY_EXPORT || 'bissu_power_query_key_98765';

async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'No autorizado. Token JWT inválido o ausente.' });
  }
}

async function authenticateExport(request, reply) {
  const queryKey = request.query.api_key;
  const authHeader = request.headers.authorization;
  let tokenKey = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    tokenKey = authHeader.substring(7);
  }

  // Permite autenticación mediante API_KEY por query param o header Bearer
  if (queryKey === API_KEY_EXPORT || tokenKey === API_KEY_EXPORT) {
    return; // Válido
  }

  // O intenta verificar si es un JWT válido
  try {
    await request.jwtVerify();
    return;
  } catch (err) {
    // Si no es ni API Key válida ni JWT válido
    reply.status(401).send({ error: 'Acceso denegado. API Key o Token de exportación inválido.' });
  }
}

module.exports = {
  authenticate,
  authenticateExport
};
