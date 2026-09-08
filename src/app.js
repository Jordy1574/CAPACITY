const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const fastify = require('fastify')({
  logger: {
    level: 'info'
  }
});

fastify.setErrorHandler((err, request, reply) => {
  if (err.isAppError) {
    return reply.status(err.statusCode).send({ error: err.message });
  }
  if (err.validation) {
    return reply.status(400).send({ error: 'Datos inválidos: ' + err.message });
  }
  request.log.error(err);
  return reply.status(500).send({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'bissu_capacity_secret_key_2026_super_secure';

// Registrar plugins
fastify.register(require('@fastify/cors'), {
  origin: true,
  credentials: true
});

fastify.register(require('@fastify/jwt'), {
  secret: JWT_SECRET
});

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/'
});

// Registrar rutas
fastify.register(require('./routes/auth'));
fastify.register(require('./routes/capacity'));
fastify.register(require('./routes/horarios'));
fastify.register(require('./routes/usuarios'));

// Ruta raíz sirve index.html
fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

// Ruta /login sirve login.html
fastify.get('/login', async (request, reply) => {
  return reply.sendFile('login.html');
});

// Rutas de la SPA: cada sección del sidebar sirve el mismo index.html
// (el enrutamiento real ocurre en el cliente vía History API en app.js).
// Agregar una nueva sección al sidebar implica sumar su ruta aquí.
const SPA_ROUTES = ['/capacity', '/horarios', '/usuarios'];
SPA_ROUTES.forEach(route => {
  fastify.get(route, async (request, reply) => {
    return reply.sendFile('index.html');
  });
});

// Iniciar servidor
const start = async () => {
  try {
    await fastify.listen({ port: parseInt(PORT, 10), host: HOST });
    console.log(`\n======================================================`);
    console.log(`  bissú Capacity Servidor iniciado con éxito!`);
    console.log(`  URL Local: http://localhost:${PORT}`);
    console.log(`  Login Demo: http://localhost:${PORT}/login`);
    console.log(`======================================================\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
