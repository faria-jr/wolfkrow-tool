import type {
  AICompletionOptions,
  AICompletionResult,
  AIStreamChunk,
  AIStreamPort,
  ChatSession,
  ChatSessionRepo,
  Message,
  MessageRepo,
  UsageRecord,
  UsageRecordInput,
  UsageRepo,
} from '@wolfkrow/domain';
import { ChatSession as ChatSessionEntity, Message as MessageEntity } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompactSessionUseCase, SendMessageUseCase } from '../index';

// ── InMemory repos ───────────────────────────────────────────────────────────

class InMemoryChatSessionRepo implements ChatSessionRepo {
  private readonly store = new Map<string, ChatSession>();

  async findAll(): Promise<ChatSession[]> {
    return [...this.store.values()];
  }
  async findById(id: string): Promise<ChatSession | null> {
    return this.store.get(id) ?? null;
  }
  async findByUserId(userId: string): Promise<ChatSession[]> {
    return [...this.store.values()].filter((s) => s.userId === userId);
  }
  async save(session: ChatSession): Promise<ChatSession> {
    this.store.set(session.id, session);
    return session;
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

class InMemoryMessageRepo implements MessageRepo {
  private readonly store = new Map<string, Message>();

  async findBySessionId(sessionId: string): Promise<Message[]> {
    return [...this.store.values()].filter((m) => m.sessionId === sessionId);
  }
  async save(message: Message): Promise<Message> {
    this.store.set(message.id, message);
    return message;
  }
  async deleteBySessionId(sessionId: string): Promise<void> {
    for (const [id, msg] of this.store) {
      if (msg.sessionId === sessionId) this.store.delete(id);
    }
  }
}

// ── FakeAIStreamPort ─────────────────────────────────────────────────────────

function makeFakeAI(parts: string[], summaryResponse = 'Summary.'): AIStreamPort {
  return {
    async *query(_opts: AICompletionOptions): AsyncIterable<AIStreamChunk> {
      for (const delta of parts) yield { delta };
      yield { delta: '', done: true, inputTokens: 10, outputTokens: parts.length };
    },
    async complete(_opts: AICompletionOptions): Promise<AICompletionResult> {
      return { content: summaryResponse, usage: { inputTokens: 5, outputTokens: 3 } };
    },
  };
}

async function collect(stream: AsyncIterable<AIStreamChunk>): Promise<AIStreamChunk[]> {
  const out: AIStreamChunk[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

/** Fake AI that emits some deltas then aborts mid-stream (T19). */
function makeAbortingAI(parts: string[]): AIStreamPort {
  return {
    async *query(_opts: AICompletionOptions): AsyncIterable<AIStreamChunk> {
      for (const delta of parts) yield { delta };
      throw new DOMException('Aborted', 'AbortError');
    },
    async complete(_opts: AICompletionOptions): Promise<AICompletionResult> {
      return { content: '', usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}

/** Fake AI that aborts with the Anthropic SDK's APIUserAbortError variant. */
function makeSdkAbortingAI(parts: string[]): AIStreamPort {
  return {
    async *query(_opts: AICompletionOptions): AsyncIterable<AIStreamChunk> {
      for (const delta of parts) yield { delta };
      const err = new Error('Request was aborted.');
      err.name = 'APIUserAbortError';
      throw err;
    },
    async complete(_opts: AICompletionOptions): Promise<AICompletionResult> {
      return { content: '', usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}

// ── SendMessageUseCase ───────────────────────────────────────────────────────

describe('SendMessageUseCase', () => {
  let sessionRepo: InMemoryChatSessionRepo;
  let messageRepo: InMemoryMessageRepo;
  let ai: AIStreamPort;

  beforeEach(() => {
    sessionRepo = new InMemoryChatSessionRepo();
    messageRepo = new InMemoryMessageRepo();
    ai = makeFakeAI(['Hello', ' world']);
  });

  const input = (overrides: Partial<Parameters<SendMessageUseCase['execute']>[0]> = {}) => ({
    sessionId: undefined,
    userId: 'u1',
    agentId: undefined,
    content: 'hi',
    model: 'claude-3-5-sonnet-20241022',
    ...overrides,
  });

  it('creates new session when sessionId undefined', async () => {
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai);
    const stream = await uc.execute(input());
    await collect(stream);
    const sessions = await sessionRepo.findByUserId('u1');
    expect(sessions).toHaveLength(1);
  });

  it('reuses existing session', async () => {
    const session = await sessionRepo.save(
      ChatSessionEntity.create({
        userId: 'u1',
        agentId: undefined,
        title: undefined,
        archived: false,
      })
    );
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai);
    await collect(await uc.execute(input({ sessionId: session.id })));
    const sessions = await sessionRepo.findByUserId('u1');
    expect(sessions).toHaveLength(1);
  });

  it('saves user message before streaming', async () => {
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai);
    const stream = await uc.execute(input({ content: 'hello' }));
    const sessions = await sessionRepo.findByUserId('u1');
    const msgs = await messageRepo.findBySessionId(sessions[0]!.id);
    expect(msgs.some((m) => m.role === 'user' && m.content === 'hello')).toBe(true);
    await collect(stream);
  });

  it('yields text chunks from AI', async () => {
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai);
    const chunks = await collect(await uc.execute(input()));
    const text = chunks
      .filter((c) => c.delta !== '')
      .map((c) => c.delta)
      .join('');
    expect(text).toBe('Hello world');
  });

  it('yields done chunk with usage', async () => {
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai);
    const chunks = await collect(await uc.execute(input()));
    const done = chunks.find((c) => c.done);
    expect(done).toBeDefined();
    expect(done?.inputTokens).toBe(10);
  });

  it('saves assistant message after streaming', async () => {
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai);
    await collect(await uc.execute(input()));
    const sessions = await sessionRepo.findByUserId('u1');
    const msgs = await messageRepo.findBySessionId(sessions[0]!.id);
    expect(msgs.some((m) => m.role === 'assistant')).toBe(true);
    const assistantMsg = msgs.find((m) => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('Hello world');
  });

  it('records token usage when usageRepo provided', async () => {
    const insertMock = vi.fn();
    const usageRepo: UsageRepo = {
      insert: insertMock,
      findMany: () => [] as UsageRecord[],
      totalCostCents: () => 0,
    };
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai, { usageRepo });
    await collect(await uc.execute(input({ model: 'claude-sonnet-4-6' })));
    expect(insertMock).toHaveBeenCalledOnce();
    const record = insertMock.mock.calls[0]?.[0] as UsageRecordInput;
    expect(record.inputTokens).toBe(10);
    expect(record.outputTokens).toBe(2);
    expect(record.source).toBe('chat');
    expect(record.model).toBe('claude-sonnet-4-6');
  });

  it('builds multi-turn context from history', async () => {
    const queriedMessages: AICompletionOptions[] = [];
    const recordingAI: AIStreamPort = {
      async *query(opts: AICompletionOptions) {
        queriedMessages.push(opts);
        yield { delta: 'reply' };
        yield { delta: '', done: true };
      },
      async complete(_opts) {
        return { content: 'ok', usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };

    const session = await sessionRepo.save(
      ChatSessionEntity.create({
        userId: 'u1',
        agentId: undefined,
        title: undefined,
        archived: false,
      })
    );
    const existingMsg = MessageEntity.create({
      sessionId: session.id,
      userId: 'u1',
      role: 'user',
      content: 'first message',
    });
    await messageRepo.save(existingMsg);

    const uc = new SendMessageUseCase(sessionRepo, messageRepo, recordingAI);
    await collect(await uc.execute(input({ sessionId: session.id, content: 'second message' })));

    expect(queriedMessages[0]?.messages.length).toBe(2);
    expect(queriedMessages[0]?.messages[0]?.content).toBe('first message');
    expect(queriedMessages[0]?.messages[1]?.content).toBe('second message');
  });

  it('flushes partial assistant message when stream is aborted (T19)', async () => {
    ai = makeAbortingAI(['partial', ' response']);
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai);
    const chunks = await collect(await uc.execute(input()));

    // Stream must close cleanly with a done chunk on abort
    expect(chunks.some((c) => c.done)).toBe(true);
    // Partial assistant message must be persisted despite the abort
    const sessions = await sessionRepo.findByUserId('u1');
    const msgs = await messageRepo.findBySessionId(sessions[0]!.id);
    const assistantMsg = msgs.find((m) => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('partial response');
  });

  it('flushes partial message on Anthropic APIUserAbortError (abort robustness)', async () => {
    ai = makeSdkAbortingAI(['partial', ' reply']);
    const uc = new SendMessageUseCase(sessionRepo, messageRepo, ai);
    const chunks = await collect(await uc.execute(input()));

    expect(chunks.some((c) => c.done)).toBe(true);
    const sessions = await sessionRepo.findByUserId('u1');
    const msgs = await messageRepo.findBySessionId(sessions[0]!.id);
    const assistantMsg = msgs.find((m) => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('partial reply');
  });
});

// ── CompactSessionUseCase ────────────────────────────────────────────────────

describe('CompactSessionUseCase', () => {
  let sessionRepo: InMemoryChatSessionRepo;
  let messageRepo: InMemoryMessageRepo;
  const ai = makeFakeAI([], 'Condensed summary of prior conversation.');

  const SESSION_ID = 'session-1';
  const USER_ID = 'u1';

  function makeMessages(count: number): Message[] {
    return Array.from({ length: count }, (_, i) =>
      MessageEntity.fromProps({
        id: `m${i}`,
        sessionId: SESSION_ID,
        userId: USER_ID,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'a'.repeat(100),
        createdAt: new Date(),
      })
    );
  }

  beforeEach(async () => {
    sessionRepo = new InMemoryChatSessionRepo();
    messageRepo = new InMemoryMessageRepo();
    const session = ChatSessionEntity.fromProps({
      id: SESSION_ID,
      userId: USER_ID,
      agentId: undefined,
      title: undefined,
      archived: false,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivity: new Date(),
    });
    await sessionRepo.save(session);
  });

  it('returns compacted=false when under threshold', async () => {
    const msgs = makeMessages(2);
    for (const m of msgs) await messageRepo.save(m);
    const uc = new CompactSessionUseCase(messageRepo, ai);
    const result = await uc.execute({
      sessionId: SESSION_ID,
      userId: USER_ID,
      model: 'claude-3-5-sonnet-20241022',
      tokenThreshold: 10_000,
    });
    expect(result.compacted).toBe(false);
  });

  it('compacts when over threshold and keeps last 6 messages', async () => {
    const msgs = makeMessages(10);
    for (const m of msgs) await messageRepo.save(m);
    const uc = new CompactSessionUseCase(messageRepo, ai);
    const result = await uc.execute({
      sessionId: SESSION_ID,
      userId: USER_ID,
      model: 'claude-3-5-sonnet-20241022',
      tokenThreshold: 50,
    });
    expect(result.compacted).toBe(true);
    const remaining = await messageRepo.findBySessionId(SESSION_ID);
    // summary system msg + 6 kept
    expect(remaining.length).toBe(7);
    expect(remaining[0]?.role).toBe('system');
    expect(remaining[0]?.content).toContain('[Previous context summary]');
  });

  it('afterTokens < beforeTokens after compaction', async () => {
    const msgs = makeMessages(10);
    for (const m of msgs) await messageRepo.save(m);
    const uc = new CompactSessionUseCase(messageRepo, ai);
    const result = await uc.execute({
      sessionId: SESSION_ID,
      userId: USER_ID,
      model: 'claude-3-5-sonnet-20241022',
      tokenThreshold: 50,
    });
    expect(result.afterTokens).toBeLessThan(result.beforeTokens);
  });
});
