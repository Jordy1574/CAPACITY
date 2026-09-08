const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');

async function authRoutes(fastify, options) {
  fastify.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;
    const tokenPayload = await authService.login(email, password);
    const token = fastify.jwt.sign(tokenPayload, { expiresIn: '8h' });

    return reply.send({
      message: 'Inicio de sesión exitoso',
      token,
      user: tokenPayload
    });
  });

  fastify.get('/api/auth/me', { onRequest: [authenticate] }, async (request, reply) => {
    return reply.send({ user: request.user });
  });
}

module.exports = authRoutes;
