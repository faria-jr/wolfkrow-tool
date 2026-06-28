/**
 * Chat AI adapter — bridges the orchestrator stream to the AIStreamPort used
 * by SendMessageUseCase. Extracted from chat.ts to keep the route module under
 * the size limit.
 */

import type { AICompletionOptions, AICompletionResult, AIStreamChunk, AIStreamPort } from '@wolfkrow/domain';
import type { ImagePart } from '@wolfkrow/infra';

import type { OrchestratorService } from '../orchestrator';

export function adapterOptions(
  provider: string | undefined,
  agentId: string | undefined,
  userId: string | undefined
): { provider?: string; agentId?: string; userId?: string } {
  return {
    ...(provider !== undefined ? { provider } : {}),
    ...(agentId !== undefined ? { agentId } : {}),
    ...(userId !== undefined ? { userId } : {}),
  };
}

export function makeAIAdapter(
  orchestrator: OrchestratorService,
  opts: { provider?: string; agentId?: string; userId?: string },
  imageParts?: ImagePart[]
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
