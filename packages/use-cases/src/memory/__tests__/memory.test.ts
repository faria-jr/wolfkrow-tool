import type {
  DailySummaryRepo,
  EmbeddingPort,
  MemorySearchResult,
  SemanticMemoryRepo,
 DailySummary} from '@wolfkrow/domain';
import { NotFoundError, SemanticMemory } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AddMemoryUseCase,
  DeleteMemoryUseCase,
  GenerateDailySummaryUseCase,
  ListMemoriesUseCase,
  SearchMemoryUseCase,
} from '../index';

// ── Fakes ────────────────────────────────────────────────────────────────────

class InMemoryMemoryRepo implements SemanticMemoryRepo {
  readonly store = new Map<string, SemanticMemory>();

  async findById(id: string): Promise<SemanticMemory | null> { return this.store.get(id) ?? null; }
  async findByUserId(userId: string): Promise<SemanticMemory[]> {
    return [...this.store.values()].filter((m) => m.userId === userId);
  }
  async save(memory: SemanticMemory): Promise<SemanticMemory> {
    this.store.set(memory.id, memory);
    return memory;
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async deleteByUserId(userId: string): Promise<void> {
    [...this.store.entries()].filter(([, m]) => m.userId === userId).forEach(([k]) => this.store.delete(k));
  }
  async vectorSearch(_embedding: number[], userId: string, limit: number): Promise<MemorySearchResult[]> {
    return [...this.store.values()].filter((m) => m.userId === userId).slice(0, limit)
      .map((memory, i) => ({ memory, distance: i * 0.1 }));
  }
  async hybridSearch(
    embedding: number[],
    userId: string,
    limit: number,
  ): Promise<{ memory: SemanticMemory; score: number; vectorDistance?: number }[]> {
    const results = await this.vectorSearch(embedding, userId, limit);
    return results.map((r) => ({ memory: r.memory, score: 1 - r.distance, vectorDistance: r.distance }));
  }
}

class InMemoryDailySummaryRepo implements DailySummaryRepo {
  readonly store = new Map<string, DailySummary>();
  async findByUserIdAndDate(userId: string, date: string): Promise<DailySummary | null> {
    return [...this.store.values()].find((s) => s.userId === userId && s.date === date) ?? null;
  }
  async findByUserId(userId: string): Promise<DailySummary[]> {
    return [...this.store.values()].filter((s) => s.userId === userId);
  }
  async save(summary: DailySummary): Promise<DailySummary> {
    this.store.set(summary.id, summary);
    return summary;
  }
}

class FakeEmbedder implements EmbeddingPort {
  readonly dimensions = 4;
  async embed(_text: string): Promise<number[]> { return [0.1, 0.2, 0.3, 0.4]; }
  async embedBatch(texts: string[]): Promise<number[][]> { return texts.map(() => [0.1, 0.2, 0.3, 0.4]); }
}

// ── AddMemoryUseCase ─────────────────────────────────────────────────────────

describe('AddMemoryUseCase', () => {
  let repo: InMemoryMemoryRepo;
  let embedder: FakeEmbedder;

  beforeEach(() => {
    repo = new InMemoryMemoryRepo();
    embedder = new FakeEmbedder();
  });

  it('persists memory with embedding', async () => {
    const uc = new AddMemoryUseCase(repo, embedder);
    const result = await uc.execute({
      userId: 'u1',
      content: 'I prefer dark mode.',
      source: 'user',
      importance: 80,
    });
    expect(result.memory.content).toBe('I prefer dark mode.');
    expect(result.memory.embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(result.memory.importance).toBe(80);
    expect(await repo.findById(result.memory.id)).not.toBeNull();
  });

  it('clamps importance to 0-100', async () => {
    const uc = new AddMemoryUseCase(repo, embedder);
    const high = await uc.execute({ userId: 'u1', content: 'x', source: 'agent', importance: 150 });
    expect(high.memory.importance).toBe(100);
    const low = await uc.execute({ userId: 'u1', content: 'y', source: 'agent', importance: -10 });
    expect(low.memory.importance).toBe(0);
  });
});

// ── SearchMemoryUseCase ──────────────────────────────────────────────────────

describe('SearchMemoryUseCase', () => {
  let repo: InMemoryMemoryRepo;
  let embedder: FakeEmbedder;

  beforeEach(async () => {
    repo = new InMemoryMemoryRepo();
    embedder = new FakeEmbedder();
    await repo.save(SemanticMemory.create({
      userId: 'u1', content: 'I prefer dark mode.', source: 'user',
      importance: 80, embedding: [0.1, 0.2, 0.3, 0.4], metadata: {},
    }));
  });

  it('returns relevant memories', async () => {
    const uc = new SearchMemoryUseCase(repo, embedder);
    const result = await uc.execute({ userId: 'u1', query: 'dark mode', limit: 5 });
    expect(result.results.length).toBeGreaterThan(0);
    result.results.forEach((r) => expect(typeof r.distance).toBe('number'));
  });

  it('returns empty for empty query', async () => {
    const uc = new SearchMemoryUseCase(repo, embedder);
    const result = await uc.execute({ userId: 'u1', query: '', limit: 5 });
    expect(result.results).toHaveLength(0);
  });
});

// ── ListMemoriesUseCase ──────────────────────────────────────────────────────

describe('ListMemoriesUseCase', () => {
  let repo: InMemoryMemoryRepo;

  beforeEach(async () => {
    repo = new InMemoryMemoryRepo();
    await repo.save(SemanticMemory.create({ userId: 'u1', content: 'a', source: 'user', importance: 50, embedding: undefined, metadata: {} }));
    await repo.save(SemanticMemory.create({ userId: 'u1', content: 'b', source: 'agent', importance: 70, embedding: undefined, metadata: {} }));
    await repo.save(SemanticMemory.create({ userId: 'u2', content: 'c', source: 'user', importance: 60, embedding: undefined, metadata: {} }));
  });

  it('lists memories for user', async () => {
    const uc = new ListMemoriesUseCase(repo);
    const result = await uc.execute({ userId: 'u1' });
    expect(result.memories).toHaveLength(2);
  });

  it('returns empty for user with no memories', async () => {
    const uc = new ListMemoriesUseCase(repo);
    const result = await uc.execute({ userId: 'nobody' });
    expect(result.memories).toHaveLength(0);
  });
});

// ── DeleteMemoryUseCase ──────────────────────────────────────────────────────

describe('DeleteMemoryUseCase', () => {
  let repo: InMemoryMemoryRepo;

  beforeEach(async () => {
    repo = new InMemoryMemoryRepo();
    await repo.save(SemanticMemory.create({ userId: 'u1', content: 'to delete', source: 'user', importance: 50, embedding: undefined, metadata: {} }));
  });

  it('removes memory', async () => {
    const uc = new DeleteMemoryUseCase(repo);
    const mem = [...repo.store.values()][0]!;
    await uc.execute({ memoryId: mem.id, userId: 'u1' });
    expect(await repo.findById(mem.id)).toBeNull();
  });

  it('throws NotFoundError for unknown id', async () => {
    const uc = new DeleteMemoryUseCase(repo);
    await expect(uc.execute({ memoryId: 'bad', userId: 'u1' })).rejects.toThrow(NotFoundError);
  });
});

// ── GenerateDailySummaryUseCase ──────────────────────────────────────────────

describe('GenerateDailySummaryUseCase', () => {
  let summaryRepo: InMemoryDailySummaryRepo;

  beforeEach(() => {
    summaryRepo = new InMemoryDailySummaryRepo();
  });

  it('creates daily summary', async () => {
    const uc = new GenerateDailySummaryUseCase(summaryRepo);
    const result = await uc.execute({
      userId: 'u1',
      date: '2026-06-21',
      content: 'Worked on authentication and knowledge base features.',
      sessionCount: 3,
      messageCount: 47,
      tokensUsed: 12000,
      cost: 0,
    });
    expect(result.summary.date).toBe('2026-06-21');
    expect(result.summary.sessionCount).toBe(3);
    expect(await summaryRepo.findByUserIdAndDate('u1', '2026-06-21')).not.toBeNull();
  });
});
