/**
 * Chat routes — SSE streaming via SendMessageUseCase.
 * Session persistence via Drizzle (DrizzleChatSessionRepo / DrizzleMessageRepo).
 */

import type { AICompletionOptions, AICompletionResult, AIStreamChunk, AIStreamPort } from '@wolfkrow/domain';
import type { ImagePart } from '@wolfkrow/infra';
import { DEFAULT_CHAT_MODEL } from '@wolfkrow/shared-types';
import { CompactSessionUseCase, SendMessageUseCase } from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { requestToolPermission, resolveToolPermission } from '../chat/permission-store';
import { getAgenticStreamPort, getChatWorkDir, getRepos } from '../container';
import { getAnthropicApiKey } from '../lib/keychain';
import type { Logger } from '../logger';
import { recordChatTurn } from '../memory/lifecycle';
import { OrchestratorService } from '../orchestrator';
import type { AuthFastifyInstance } from '../types/fastify';

import type { AttachmentInput } from './chat-attachments';
import { processAttachments } from './chat-attachments';
import { chatSessionRoutes } from './chat-sessions';

interface ChatBody {
  message: string;
  model?: string;
  provider?: string;
  system?: string;
  sessionId?: string;
  agentId?: string;
  attachments?: AttachmentInput[];
}

interface CompactBody { model?: string; tokenThreshold?: number; }

interface SendCtx {
  orchestrator: OrchestratorService;
  log: Logger;
  signal: AbortSignal;
  sse: (data: unknown) => void;
}

const DEFAULT_MODEL = DEFAULT_CHAT_MODEL;
const AUTO_COMPACT_THRESHOLD = 8000;

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
    } else if (chunk.toolPermission) {
      const { callId, name, input, prompt } = chunk.toolPermission;
      sse({ type: 'tool_permission', id: callId, name, input, prompt });
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

async function autoCompact(
  sessionId: string,
  userId: string,
  model: string,
  ai: AIStreamPort,
): Promise<void> {
  const messageRepo = getRepos().message;
  await new CompactSessionUseCase(messageRepo, ai).execute({
    sessionId,
    userId,
    model,
    tokenThreshold: AUTO_COMPACT_THRESHOLD,
  });
}

async function handleSendRequest(
  body: ChatBody,
  authUserId: string | undefined,
  ctx: SendCtx,
): Promise<void> {
  const { message, model = DEFAULT_MODEL, provider, system, sessionId, agentId, attachments } = body;
  const userId = authUserId ?? 'anonymous';

  ctx.sse({ type: 'ack', message });

  const { content, imageParts } = await processAttachments(message, attachments);
  let ai = makeAIAdapter(ctx.orchestrator, adapterOptions(provider, agentId, authUserId), imageParts);

  // T17: when the agent declares allowed tools, switch to an agentic provider
  // (claude-agent + tools) so destructive tool calls surface tool_permission
  // events the UI must approve. Agentic mode does not consume attachments yet.
  if (agentId) {
    const agent = await getRepos().agent.findById(agentId);
    if (agent && agent.allowedTools.length > 0) {
      const apiKey = await getAnthropicApiKey();
      ai = getAgenticStreamPort({
        apiKey,
        allowedTools: agent.allowedTools,
        workDir: getChatWorkDir(userId),
        requestPermission: (callId) => requestToolPermission(callId),
      });
    }
  }

  const { chatSession: sessionRepo, message: messageRepo, tokenUsage: usageRepo } = getRepos();
  const useCase = new SendMessageUseCase(sessionRepo, messageRepo, ai, { usageRepo });

  const stream = await useCase.execute({
    sessionId, userId, agentId, content, model, signal: ctx.signal,
    ...(system !== undefined ? { system } : {}),
  });

  await writeStreamAsSse(stream, ctx.sse);

  if (sessionId) {
    autoCompact(sessionId, userId, model, ai).catch(() => undefined);
  }

  if (authUserId) {
    recordChatTurn(ctx.log, authUserId, [{ role: 'user', content: message }]);
  }
}

export async function chatRoutes(server: AuthFastifyInstance) {
  const orchestrator = new OrchestratorService({ logger: server.log as unknown as Logger });

  server.post<{ Body: ChatBody }>(
    '/send',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      const ac = new AbortController();
      request.raw.on('close', () => ac.abort());
      const sse = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      try {
        await handleSendRequest(request.body, request.user?.userId, {
          orchestrator, log: server.log as unknown as Logger, signal: ac.signal, sse,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
        server.log.error({ err }, 'Chat stream error');
      } finally {
        reply.raw.end();
      }
    },
  );

  server.post<{ Params: { id: string }; Body: CompactBody }>(
    '/sessions/:id/compact',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const userId = request.user?.userId ?? 'anonymous';
      const model = request.body.model ?? DEFAULT_MODEL;
      const ai = makeAIAdapter(orchestrator, adapterOptions(undefined, undefined, userId));
      try {
        const result = await new CompactSessionUseCase(getRepos().message, ai).execute({
          sessionId: request.params.id, userId, model,
          ...(request.body.tokenThreshold !== undefined ? { tokenThreshold: request.body.tokenThreshold } : {}),
        });
        return result;
      } catch (err) {
        server.log.error({ err }, 'Compact session error');
        return reply.status(500).send({ error: 'Compaction failed' });
      }
    },
  );

  // T17: resolve a pending tool-permission request (UI approves/denies a
  // destructive tool call surfaced via the tool_permission SSE event).
  server.post<{ Body: PermissionBody }>(
    '/permission',
    { preHandler: [server.authenticate] },
    permissionHandler,
  );

  await chatSessionRoutes(server);
}

interface PermissionBody { callId: string; approved: boolean }

async function permissionHandler(
  request: FastifyRequest<{ Body: PermissionBody }>,
  reply: FastifyReply,
) {
  const { callId, approved } = request.body;
  const ok = resolveToolPermission(callId, approved);
  if (!ok) return reply.status(404).send({ error: 'No pending permission for callId' });
  return { resolved: true };
}

