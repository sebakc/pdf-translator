import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { translateRoute } from './routes/translate.js';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const DEV_MODE = process.env.DEV_MODE === 'true';

const fastify = Fastify({
  logger: true,
  bodyLimit: 104857600 // 100MB limit
});

if (DEV_MODE) {
  fastify.log.warn('⚠️  DEV_MODE is ENABLED - Browser will be visible and screenshots will be saved');
} else {
  fastify.log.info('DEV_MODE is disabled - Browser will run in headless mode');
}

// Register plugins
await fastify.register(cors, {
  origin: true
});

await fastify.register(multipart, {
  limits: {
    fileSize: 104857600 // 100MB
  }
});

// Register routes
fastify.register(translateRoute, { prefix: '/api' });

// Health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
