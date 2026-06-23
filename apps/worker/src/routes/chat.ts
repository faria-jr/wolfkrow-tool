/**
 * Chat routes — SSE streaming via SendMessageUseCase.
 * Session persistence via Drizzle (DrizzleChatSessionRepo / DrizzleMessageRepo).
 */

import type { AICompletionOptions, AICompletionResult, AIStreamChunk, AIStreamPort } from '@wolfkrow/domain';
import { DrizzleChatSessionRepo, DrizzleMessageRepo, DrizzleTokenUsageRepo } from '@wolfkrow/infra';
import type { ImagePart } from '@wolfkrow/infra';
import { DEFAULT_CHAT_MODEL } from '@wolfkrow/shared-types';
import { SendMessageUseCase } from '@wolfkrow/use-cases';

import type { Logger } from '../logger';
import { recordChatTurn } from '../memory/lifecycle';
import { OrchestratorService } from '../orchestrator';
import type { AuthFastifyInstance } from '../types/fastify';

import type { AttachmentInput } from './chat-attachments';
import { processAttachments } from './chat-attachments';

interface ChatBody {
  message: string;
  model?: string;
  provider?: string;
  system?: string;
  sessionId?: string;
  agentId?: string;
  attachments?: AttachmentInput[];
}

const DEFAULT_MODEL = DEFAULT_CHAT_MODEL;

const sessionRepo = new DrizzleChatSessionRepo();
const messageRepo = new DrizzleMessageRepo();
const usageRepo = new DrizzleTokenUsageRepo();

/** Build adapter opts, omitting undefined values (exactOptionalPropertyTypes). */
function adapterOptions(
  provider: string | undefined,
  agentId: string | undefined,
  userId: string | undefined,
): { provider?: string; agentId?: string; userId?: string } {
  return {
    ...(provider !== undefined ? { provider } : {}),
    ...(agentId !== undefined ? { agentId } : {}),
    ...(userId !== undefined ? { userId } : {}),
  };
}

/** Write the AI stream as SSE events (ack/done/text/tool_call/tool_result). */
async function writeStreamAsSse(
  stream: AsyncIterable<AIStreamChunk>,
  sse: (data: unknown) => void,
): Promise<void> {
  for await (const chunk of stream) {
    if (chunk.done) {
      sse({ type: 'done', usage: { inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens } });
    } else if (chunk.toolCall) {
      const { id, name, input } = chunk.toolCall;
      sse({ type: 'tool_call', id, name, input });
    } else if (chunk.toolResult) {
      const { callId, output, isError } = chunk.toolResult;
      sse({ type: 'tool_result', callId, output, isError });
    } else if (chunk.delta) {
      sse({ type: 'text', content: chunk.delta });
    }
  }
}

function makeAIAdapter(
  orchestrator: OrchestratorService,
  opts: { provider?: string; agentId?: string; userId?: string },
  imageParts?: ImagePart[],
): AIStreamPort {
  function query(options: AICompletionOptions): AsyncIterable<AIStreamChunk> {
    return orchestrator.stream({
      messages: options.messages,
      model: options.model,
      ...(opts.provider !== undefined ? { provider: opts.provider } : {}),
      ...(opts.agentId !== undefined ? { agentId: opts.agentId } : {}),
      ...(opts.userId !== undefined ? { userId: opts.userId } : {}),
      ...(options.system !== undefined ? { system: options.system } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(imageParts?.length ? { imageParts } : {}),
    }) as AsyncIterable<AIStreamChunk>;
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
      const { message, model = DEFAULT_MODEL, provider, system, sessionId, agentId, attachments } = request.body;

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

        const { content, imageParts } = await processAttachments(message, attachments);

        const ai = makeAIAdapter(
          orchestrator,
          adapterOptions(provider, agentId, request.user?.userId),
          imageParts,
        );
        const useCase = new SendMessageUseCase(sessionRepo, messageRepo, ai, usageRepo);

        const stream = await useCase.execute({
          sessionId,
          userId: request.user?.userId ?? 'anonymous',
          agentId,
          content,
          model,
          signal: ac.signal,
          ...(system !== undefined ? { system } : {}),
        });

        await writeStreamAsSse(stream, sse);

        const chatUserId = request.user?.userId;
        if (chatUserId) {
          recordChatTurn(server.log as unknown as Logger, chatUserId, [
            { role: 'user', content: message },
          ]);
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
