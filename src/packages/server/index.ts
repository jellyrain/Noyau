import Fastify from 'fastify';
import { openProduct } from '@noyau/core';
import type { Product } from '@noyau/extension-contract';

export async function serve(product: Product, directory: string, port = 3210) {
  const session = openProduct(product, directory);
  const server = Fastify({ bodyLimit: session.maxDraftBytes });
  server.addHook('onClose', async () => session.close());
  // 让两端在同一处解析产品草稿，Fastify 仍负责限制请求体大小。
  server.removeContentTypeParser('application/json');
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, text, done) => done(null, text));
  server.route<{ Body: string }>({
    method: ['GET', 'POST'],
    url: '/*',
    async handler(request, reply) {
      const host = `127.0.0.1:${request.socket.localPort}`;
      const origin = `http://${host}`;
      if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== origin)) {
        return reply.code(403).send();
      }
      const response = await session.handle(new Request(origin + request.url, {
        method: request.method,
        headers: { 'content-type': request.headers['content-type'] ?? '' },
        body: request.method === 'POST' ? request.body : undefined,
      }));
      return reply.send(response);
    },
  });
  try {
    const url = await server.listen({ host: '127.0.0.1', port });
    return { url, close: () => server.close() };
  } catch (error) {
    await server.close();
    throw error;
  }
}
