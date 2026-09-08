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

const DIST_DIR = path.join(__dirname, '../dist');

fastify.register(require('@fastify/static'), {
  root: DIST_DIR,
  prefix: '/'
});

// Registrar rutas
fastify.register(require('./routes/auth'));
fastify.register(require('./routes/capacity'));
fastify.register(require('./routes/horarios'));
fastify.register(require('./routes/usuarios'));

// Fallback de la SPA: cualquier GET que no sea /api/* ni un archivo estático
// existente sirve el index.html del build de React (react-router maneja la
// ruta en el cliente). Agregar una sección nueva al sidebar no requiere tocar
// el backend.
fastify.setNotFoundHandler((request, reply) => {
  if (request.method !== 'GET' || request.raw.url.startsWith('/api/')) {
    return reply.status(404).send({ error: 'No encontrado.' });
  }
  return reply.sendFile('index.html', DIST_DIR);
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
