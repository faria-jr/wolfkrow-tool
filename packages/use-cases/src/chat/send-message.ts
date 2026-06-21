import type {
  AICompletionOptions,
  AIStreamChunk,
  AIStreamPort,
  ChatSession,
  ChatSessionRepo,
  Message,
  MessageRepo,
} from '@wolfkrow/domain';
import { Message as MessageEntity, ChatSession as ChatSessionEntity } from '@wolfkrow/domain';

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

export class SendMessageUseCase implements UseCase<SendMessageInput, SendMessageOutput> {
  constructor(
    private readonly sessionRepo: ChatSessionRepo,
    private readonly messageRepo: MessageRepo,
    private readonly ai: AIStreamPort,
  ) {}

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

    for await (const chunk of this.ai.query(options)) {
      if (chunk.delta) accumulated += chunk.delta;
      if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
      if (chunk.outputTokens !== undefined) outputTokens = chunk.outputTokens;
      yield chunk;
    }

    if (accumulated) {
      const assistantMsg = MessageEntity.create({ sessionId: session.id, userId: input.userId, role: 'assistant', content: accumulated });
      await this.messageRepo.save(assistantMsg);
    }

    await this.sessionRepo.save(session.recordActivity());
    void inputTokens;
    void outputTokens;
  }
}
