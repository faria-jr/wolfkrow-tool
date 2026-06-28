/**
 * F2.1 — Harness conversational HITL chat handler.
 *
 * Streams a real LLM reply to the operator's message, grounded in the sprint's
 * feature spec + latest coder output, using the project's configured provider/
 * model. Also parks the message as feedback so it steers the next coder round.
 */

import type { HarnessProjectRepo, AIStreamPort } from '@wolfkrow/domain';
import { ContinueHarnessConversationUseCase } from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { recordFeedback } from '../harness/feedback-store';
import { resolveAIProvider } from '../lib/provider-resolver';
import { validate, z } from '../validation';

export const chatBody = z.object({
  message: z.string().min(1).max(65_536),
  featureIndex: z.number().int().min(0).optional(),
  latestCoderOutput: z.string().max(200_000).optional(),
});

/** Wrap the project's AIProvider as the AIStreamPort the use-case expects. */
function toStreamPort(provider: {
  query: (o: never) => AsyncIterable<{ delta?: string }>;
  complete: (o: never) => Promise<unknown>;
}): AIStreamPort {
  return provider as unknown as AIStreamPort;
}

/** Write the conversation reply as SSE (text deltas + done). */
async function streamReply(
  reply: FastifyReply,
  uc: ContinueHarnessConversationUseCase,
  input: Parameters<ContinueHarnessConversationUseCase['execute']>[0],
  model: string
): Promise<void> {
  const sse = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  let received = '';
  try {
    for await (const delta of uc.execute(input, { model })) {
      received += delta;
      sse({ type: 'text', content: delta });
    }
    sse({ type: 'done', reply: received });
  } catch (err) {
    sse({ type: 'error', message: err instanceof Error ? err.message : 'Chat failed' });
  }
}

export async function sprintChatHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply,
  projectRepo: HarnessProjectRepo
): Promise<void> {
  const body = validate(chatBody, req.body);
  const project = await projectRepo.findById(req.params.id);
  if (!project) {
    reply.status(404).send({ error: 'Project not found' });
    return;
  }
  // Park the message as feedback for the next coder round (keeps the
  // feedback-steering behavior alongside the conversational answer).
  if (body.featureIndex !== undefined) recordFeedback(req.params.id, body.featureIndex, body.message);

  const { provider } = await resolveAIProvider({
    providerId: project.config.providerId,
    userId: req.user?.userId,
  });
  const uc = new ContinueHarnessConversationUseCase(toStreamPort(provider));

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  await streamReply(reply, uc, {
    projectId: req.params.id,
    message: body.message,
    ...(body.latestCoderOutput !== undefined ? { latestCoderOutput: body.latestCoderOutput } : {}),
  }, project.config.coderModel);
  reply.raw.end();
}
