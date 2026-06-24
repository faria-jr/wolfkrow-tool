import type {
  AICompletionOptions,
  AIStreamChunk,
  AIStreamPort,
  ChatSession,
  ChatSessionRepo,
  EventBus,
  Message,
  MessageRepo,
  UsageRepo,
} from '@wolfkrow/domain';
import { Message as MessageEntity, ChatSession as ChatSessionEntity, createDomainEvent, defaultPricingCalculator } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface SendMessageInput {
  sessionId: string | undefined;
  userId: string;
  agentId: string | undefined;
  content: string;
  model: string;
  system?: string;
  signal?: AbortSignal;
}

export type SendMessageOutput = AsyncIterable<AIStreamChunk>;

export interface SendMessageOptions {
  usageRepo?: UsageRepo;
  eventBus?: EventBus;
}

export class SendMessageUseCase implements UseCase<SendMessageInput, SendMessageOutput> {
  private readonly usageRepo: UsageRepo | undefined;
  private readonly eventBus: EventBus | undefined;

  constructor(
    private readonly sessionRepo: ChatSessionRepo,
    private readonly messageRepo: MessageRepo,
    private readonly ai: AIStreamPort,
    opts: SendMessageOptions = {},
  ) {
    this.usageRepo = opts.usageRepo;
    this.eventBus = opts.eventBus;
  }

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    const session = await this.loadOrCreateSession(input);
    const userMsg = MessageEntity.create({ sessionId: session.id, userId: input.userId, role: 'user', content: input.content });
    await this.messageRepo.save(userMsg);

    const history = await this.messageRepo.findBySessionId(session.id);
    const options = this.buildOptions(history, input);

    return this.streamAndSave(session, input, options);
  }

  private async loadOrCreateSession(input: SendMessageInput): Promise<ChatSession> {
    if (input.sessionId) {
      const existing = await this.sessionRepo.findById(input.sessionId);
      if (existing) return existing;
    }
    const session = ChatSessionEntity.create({ userId: input.userId, agentId: input.agentId, title: undefined, archived: false });
    return this.sessionRepo.save(session);
  }

  private buildOptions(history: Message[], input: SendMessageInput): AICompletionOptions {
    const messages = history.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));
    return {
      model: input.model,
      messages,
      ...(input.system !== undefined ? { system: input.system } : {}),
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
    };
  }

  private async *streamAndSave(session: ChatSession, input: SendMessageInput, options: AICompletionOptions): AsyncIterable<AIStreamChunk> {
    let accumulated = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let aborted = false;

    try {
      for await (const chunk of this.ai.query(options)) {
        if (chunk.delta) accumulated += chunk.delta;
        if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
        if (chunk.outputTokens !== undefined) outputTokens = chunk.outputTokens;
        yield chunk;
      }
    } catch (err) {
      // T19: Stop button aborts mid-stream — flush the partial message instead of losing it.
      if (!isAbortError(err)) throw err;
      aborted = true;
    }

    await this.finalizeTurn({ session, input, accumulated, inputTokens, outputTokens, aborted });

    if (!aborted && this.eventBus) {
      void this.eventBus.publish(createDomainEvent({
        type: 'message.turn.completed',
        aggregateId: session.id,
        payload: { userId: input.userId, inputTokens, outputTokens },
      }));
    }

    if (aborted) {
      // Close the stream cleanly so the SSE layer flushes the partial message to the client.
      yield { delta: '', done: true, inputTokens, outputTokens };
    }
  }

  /** Persist the assistant turn (partial on abort) + record usage for completed turns. */
  private async finalizeTurn(ctx: {
    session: ChatSession;
    input: SendMessageInput;
    accumulated: string;
    inputTokens: number;
    outputTokens: number;
    aborted: boolean;
  }): Promise<void> {
    const { session, input, accumulated, inputTokens, outputTokens, aborted } = ctx;
    if (accumulated) {
      const assistantMsg = MessageEntity.create({ sessionId: session.id, userId: input.userId, role: 'assistant', content: accumulated });
      await this.messageRepo.save(assistantMsg);
    }
    await this.sessionRepo.save(session.recordActivity());

    // Record usage only for fully completed turns (aborted turns are partial).
    if (!aborted && this.usageRepo && (inputTokens > 0 || outputTokens > 0)) {
      const cost = defaultPricingCalculator.cost(input.model, { inputTokens, outputTokens });
      this.usageRepo.insert({
        userId: input.userId,
        source: 'chat',
        model: input.model,
        inputTokens,
        outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cost: cost.usdCents,
        sessionId: session.id,
        ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
        timestamp: new Date(),
      });
    }
  }
}

function isAbortError(err: unknown): boolean {
  // Match AbortError (DOM/Node) AND provider variants like Anthropic's APIUserAbortError.
  if (err instanceof Error && /abort/i.test(err.name)) return true;
  return typeof DOMException !== 'undefined' && err instanceof DOMException && /abort/i.test(err.name);
}
