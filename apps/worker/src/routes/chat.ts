/**
 * Chat routes — SSE streaming via SendMessageUseCase.
 * A.3: session persistence (in-memory), multi-turn context.
 */

import type { AICompletionOptions, AICompletionResult, AIStreamChunk, AIStreamPort } from '@wolfkrow/domain';
import type { StreamChunk } from '@wolfkrow/infra';
import { SendMessageUseCase } from '@wolfkrow/use-cases';

import { InMemoryChatSessionRepo, InMemoryMessageRepo } from '../chat-store';
import type { Logger } from '../logger';
import { OrchestratorService } from '../orchestrator';
import type { AuthFastifyInstance } from '../types/fastify';

interface ChatBody {
  message: string;
  model?: string;
  provider?: string;
  system?: string;
  sessionId?: string;
  agentId?: string;
}

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

const sessionRepo = new InMemoryChatSessionRepo();
const messageRepo = new InMemoryMessageRepo();

function makeAIAdapter(orchestrator: OrchestratorService, provider?: string): AIStreamPort {
  function query(options: AICompletionOptions): AsyncIterable<AIStreamChunk> {
    return orchestrator.stream({
      messages: options.messages,
      model: options.model,
      ...(provider !== undefined ? { provider } : {}),
      ...(options.system !== undefined ? { system: options.system } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    }) as AsyncIterable<StreamChunk>;
  }

  async function complete(options: AICompletionOptions): Promise<AICompletionResult> {
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const chunk of query(options)) {
      if (chunk.delta) content += chunk.delta;
      if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
      if (chunk.outputTokens !== undefined) outputTokens = chunk.outputTokens;
    }
    return { content, usage: { inputTokens, outputTokens } };
  }

  return { query, complete };
}

export async function chatRoutes(server: AuthFastifyInstance) {
  const orchestrator = new OrchestratorService({ logger: server.log as unknown as Logger });

  server.post<{ Body: ChatBody }>(
    '/send',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { message, model = DEFAULT_MODEL, provider, system, sessionId, agentId } = request.body;

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const ac = new AbortController();
      request.raw.on('close', () => ac.abort());

      try {
        const sse = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        sse({ type: 'ack', message });

        const ai = makeAIAdapter(orchestrator, provider);
        const useCase = new SendMessageUseCase(sessionRepo, messageRepo, ai);

        const stream = await useCase.execute({
          sessionId,
          userId: request.user?.userId ?? 'anonymous',
          agentId,
          content: message,
          model,
          signal: ac.signal,
          ...(system !== undefined ? { system } : {}),
        });

        for await (const chunk of stream) {
          if (chunk.done) {
            sse({ type: 'done', usage: { inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens } });
          } else if (chunk.delta) {
            sse({ type: 'text', content: chunk.delta });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
        server.log.error({ err }, 'Chat stream error');
      } finally {
        reply.raw.end();
      }
    },
  );
}
