const fastify = require('fastify')({ logger: true });
const path = require('path');

const start = async () => {
  try {
    await fastify.register(require('@fastify/compress'));
    await fastify.register(require('@fastify/static'), {
      root: path.join(__dirname, 'public'),
      prefix: '/'
    });

    fastify.get('/orders/:orderId/invoice', function (request, reply) {
      const { orderId } = request.params;
      console.log(`Fetching invoice for order ${orderId}`);
      reply.sendFile('samples/invoice.pdf');
    });

    await fastify.listen({
      port: process.env.PORT || 5000,
      host: '0.0.0.0'
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();