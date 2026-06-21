/**
 * Chat routes (SSE streaming)
 */

import type { AuthFastifyInstance } from '../types/fastify';

interface ChatBody {
  message: string;
  sessionId?: string;
  agentId?: string;
}

export async function chatRoutes(server: AuthFastifyInstance) {
  server.post<{ Body: ChatBody }>('/send', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { message } = request.body;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const lines = [
      `data: ${JSON.stringify({ type: 'ack', message })}\n\n`,
      `data: ${JSON.stringify({ type: 'text', content: 'Resposta do worker' })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    for (const line of lines) {
      reply.raw.write(line);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    reply.raw.end();
  });
}
