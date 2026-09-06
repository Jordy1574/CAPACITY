const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

async function authRoutes(fastify, options) {
  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};

    if (!email || !password) {
      return reply.status(400).send({ error: 'Debes proporcionar correo y contraseña.' });
    }

    try {
      const sql = `
        SELECT u.id_usuario, u.email, u.password_hash, u.rol, u.id_tienda, t.nombre_tienda
        FROM usuarios u
        LEFT JOIN tiendas t ON u.id_tienda = t.id_tienda
        WHERE LOWER(u.email) = LOWER($1)
      `;
      const users = await query(sql, [email.trim()]);

      if (!users || users.length === 0) {
        return reply.status(401).send({ error: 'Credenciales inválidas. Correo no encontrado.' });
      }

      const user = users[0];
      const validPassword = bcrypt.compareSync(password, user.password_hash);

      if (!validPassword) {
        return reply.status(401).send({ error: 'Credenciales inválidas. Contraseña incorrecta.' });
      }

      const tokenPayload = {
        id_usuario: user.id_usuario,
        email: user.email,
        rol: user.rol,
        id_tienda: user.id_tienda,
        nombre_tienda: user.nombre_tienda || 'TODAS'
      };

      const token = fastify.jwt.sign(tokenPayload, { expiresIn: '8h' });

      return reply.send({
        message: 'Inicio de sesión exitoso',
        token,
        user: tokenPayload
      });
    } catch (err) {
      console.error('[AUTH LOGIN ERROR]', err);
      return reply.status(500).send({ error: 'Error en el servidor al autenticar.' });
    }
  });

  // GET /api/auth/me
  fastify.get('/api/auth/me', { onRequest: [authenticate] }, async (request, reply) => {
    return reply.send({ user: request.user });
  });
}

module.exports = authRoutes;
