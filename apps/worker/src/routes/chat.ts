/**
 * Chat routes — SSE streaming via SendMessageUseCase.
 * Session persistence via Drizzle (DrizzleChatSessionRepo / DrizzleMessageRepo).
 */

import type { AICompletionOptions, AICompletionResult, AIStreamChunk, AIStreamPort } from '@wolfkrow/domain';
import type { ImagePart } from '@wolfkrow/infra';
import { DEFAULT_CHAT_MODEL } from '@wolfkrow/shared-types';
import { CompactSessionUseCase, SendMessageUseCase } from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getDecision, requestToolPermission, resolveToolPermission } from '../chat/permission-store';
import { getChatWorkDir, getRepos, resolveAgentStreamPort } from '../container';
import type { Logger } from '../logger';
import { recordChatTurn } from '../memory/lifecycle';
import { OrchestratorService } from '../orchestrator';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

import { processAttachments } from './chat-attachments';
import { chatSessionRoutes } from './chat-sessions';

/**
 * Chat send body (SSE streaming). Worker-specific HTTP input: the message is
 * free-form text with optional model/provider/session/agent overrides.
 */
const chatSendBody = z.object({
 message: z.string().min(1).max(100_000),
 model: z.string().max(128).optional(),
 provider: z.string().max(128).optional(),
 system: z.string().max(65_536).optional(),
 sessionId: z.string().max(128).optional(),
 agentId: z.string().max(128).optional(),
 attachments: z
   .array(
     z.object({
       filename: z.string().min(1).max(255),
       mimeType: z.string().min(1).max(128),
       data: z.string().min(1),
     }),
   )
   .max(20)
   .default([]),
});

type ChatBody = z.infer<typeof chatSendBody>;

const compactBody = z.object({
 model: z.string().max(128).optional(),
 tokenThreshold: z.number().int().min(100).max(1_000_000).optional(),
});

const permissionBody = z.object({
 callId: z.string().min(1).max(128),
 approved: z.boolean(),
});

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

/** Write the AI stream as SSE events (ack/done/text/tool_call/tool_result/artifact). */
async function writeStreamAsSse(
  stream: AsyncIterable<AIStreamChunk>,
  sse: (data: unknown) => void,
): Promise<void> {
  const { createArtifactPipeline } = await import('../chat/artifact-pipeline');
  const pipeline = createArtifactPipeline();
  for await (const chunk of stream) {
    if (chunk.done) {
      sse({ type: 'done', usage: { inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens } });
    } else if (chunk.toolCall) {
      const { id, name, input } = chunk.toolCall;
      pipeline.registerToolCall(id, name, input);
      sse({ type: 'tool_call', id, name, input });
    } else if (chunk.toolResult) {
      const { callId, output, isError } = chunk.toolResult;
      sse({ type: 'tool_result', callId, output, isError });
      const artifact = pipeline.detectArtifact(callId, output, isError);
      if (artifact) {
        sse({ type: 'artifact', artifact: artifact.toJSON() });
      }
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

 //  when the agent declares allowed tools, resolve the agentic provider
 // based on the agent's configured provider (non-Anthropic uses ClaudeCompatProvider).
 // A prior durable decision (allow/deny) short-circuits the UI prompt so a
 // restart does NOT re-ask tools the user already decided on (P1-7).
  if (agentId) {
    const agent = await getRepos().agent.findById(agentId);
    if (agent && agent.allowedTools.length > 0) {
      ai = await resolveAgentStreamPort({
        agentProvider: agent.provider,
        allowedTools: agent.allowedTools,
        workDir: getChatWorkDir(userId),
        requestPermission: (callId, tool) => {
          const prior = getDecision(userId, agentId, tool);
          if (prior === 'allow') return Promise.resolve(true);
          if (prior === 'deny') return Promise.resolve(false);
          return requestToolPermission(callId, { userId, agentId, tool });
        },
        userId,
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
    (request, reply) => handleSendRoute(request, reply, server, orchestrator),
  );

  server.post<{ Params: { id: string } }>(
    '/sessions/:id/compact',
    { preHandler: [server.authenticate] },
    (request, reply) => handleCompactRoute(request, reply, server, orchestrator),
  );

  // resolve a pending tool-permission request (UI approves/denies a
  // destructive tool call surfaced via the tool_permission SSE event).
  server.post(
    '/permission',
    { preHandler: [server.authenticate] },
    permissionHandler,
  );

  await chatSessionRoutes(server);
}

/** POST /send — validate, open the SSE stream, and forward to the use-case. */
async function handleSendRoute(
  request: FastifyRequest<{ Body: ChatBody }>,
  reply: FastifyReply,
  server: AuthFastifyInstance,
  orchestrator: OrchestratorService,
): Promise<void> {
  // Validate input BEFORE opening the SSE stream so a bad body yields 400.
  const body = validate(chatSendBody, request.body);
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const ac = new AbortController();
  request.raw.on('close', () => ac.abort());
  const sse = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    await handleSendRequest(body, request.user?.userId, {
      orchestrator, log: server.log as unknown as Logger, signal: ac.signal, sse,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
    server.log.error({ err }, 'Chat stream error');
  } finally {
    reply.raw.end();
  }
}

/** POST /sessions/:id/compact — run the compaction use-case for a session. */
async function handleCompactRoute(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  server: AuthFastifyInstance,
  orchestrator: OrchestratorService,
): Promise<unknown> {
  const userId = request.user?.userId ?? 'anonymous';
  const body = validate(compactBody, request.body ?? {});
  const model = body.model ?? DEFAULT_MODEL;
  const ai = makeAIAdapter(orchestrator, adapterOptions(undefined, undefined, userId));
  try {
    const result = await new CompactSessionUseCase(getRepos().message, ai).execute({
      sessionId: request.params.id, userId, model,
      ...(body.tokenThreshold !== undefined ? { tokenThreshold: body.tokenThreshold } : {}),
    });
    return result;
  } catch (err) {
    server.log.error({ err }, 'Compact session error');
    return reply.status(500).send({ error: 'Compaction failed' });
  }
}

async function permissionHandler(
 request: FastifyRequest,
 reply: FastifyReply,
) {
 const { callId, approved } = validate(permissionBody, request.body);
 const ok = resolveToolPermission(callId, approved);
 if (!ok) return reply.status(404).send({ error: 'No pending permission for callId' });
 return { resolved: true };
}

