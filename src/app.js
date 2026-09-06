const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const fastify = require('fastify')({
  logger: {
    level: 'info'
  }
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

// Ruta raíz sirve index.html
fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

// Ruta /login sirve login.html
fastify.get('/login', async (request, reply) => {
  return reply.sendFile('login.html');
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
