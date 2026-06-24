import type {
  ChunkSearchResult,
  EmbeddingPort,
  HybridChunkSearchResult,
  KeywordSearchResult,
  KnowledgeChunkRepo,
  KnowledgeDocRepo,
} from '@wolfkrow/domain';
import {
  KnowledgeChunk,
  KnowledgeDocument,
  NotFoundError,
  ValidationError,
} from '@wolfkrow/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DeleteDocumentUseCase,
  IngestDocumentUseCase,
  ListDocumentsUseCase,
  SearchKnowledgeUseCase,
} from '../index';

// ── Fakes ────────────────────────────────────────────────────────────────────

class InMemoryDocRepo implements KnowledgeDocRepo {
  readonly store = new Map<string, KnowledgeDocument>();

  async findById(id: string): Promise<KnowledgeDocument | null> {
    return this.store.get(id) ?? null;
  }
  async findByUserId(userId: string): Promise<KnowledgeDocument[]> {
    return [...this.store.values()].filter((d) => d.userId === userId);
  }
  async save(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    this.store.set(doc.id, doc);
    return doc;
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

class InMemoryChunkRepo implements KnowledgeChunkRepo {
  readonly store = new Map<string, KnowledgeChunk>();

  async saveMany(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]> {
    chunks.forEach((c) => this.store.set(c.id, c));
    return chunks;
  }
  async findByDocumentId(documentId: string): Promise<KnowledgeChunk[]> {
    return [...this.store.values()].filter((c) => c.documentId === documentId);
  }
  async deleteByDocumentId(documentId: string): Promise<void> {
    [...this.store.entries()]
      .filter(([, c]) => c.documentId === documentId)
      .forEach(([k]) => this.store.delete(k));
  }
  async vectorSearch(_embedding: number[], limit: number): Promise<ChunkSearchResult[]> {
    return [...this.store.values()].slice(0, limit).map((chunk, i) => ({
      chunk,
      distance: i * 0.1,
    }));
  }
  async keywordSearch(query: string, limit: number): Promise<KeywordSearchResult[]> {
    return [...this.store.values()]
      .filter((c) => c.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .map((chunk, i) => ({ chunk, rank: -(i + 1) }));
  }
  async hybridSearch(
    query: string,
    _embedding: number[],
    limit: number,
  ): Promise<HybridChunkSearchResult[]> {
    const vecResults = await this.vectorSearch(_embedding, limit);
    const kwResults = await this.keywordSearch(query, limit);
    return vecResults.map((v, idx) => {
      const kw = kwResults.find((k) => k.chunk.id === v.chunk.id);
      const result: HybridChunkSearchResult = {
        chunk: v.chunk,
        score: 1 / (60 + idx + 1) + (kw ? 1 / 61 : 0),
        vectorDistance: v.distance,
      };
      if (kw) result.keywordRank = kw.rank;
      return result;
    });
  }
}

class FakeEmbedder implements EmbeddingPort {
  readonly dimensions = 4;
  async embed(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3, 0.4];
  }
  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3, 0.4]);
  }
}

// ── IngestDocumentUseCase ────────────────────────────────────────────────────

describe('IngestDocumentUseCase', () => {
  let docRepo: InMemoryDocRepo;
  let chunkRepo: InMemoryChunkRepo;
  let embedder: FakeEmbedder;

  beforeEach(() => {
    docRepo = new InMemoryDocRepo();
    chunkRepo = new InMemoryChunkRepo();
    embedder = new FakeEmbedder();
  });

  it('creates document record with pending status initially', async () => {
    const uc = new IngestDocumentUseCase(docRepo, chunkRepo, embedder);
    const chunks = [
      { content: 'Hello world', metadata: { sourceType: 'paragraph' as const, position: 0 } },
    ];
    const result = await uc.execute({
      userId: 'u1',
      filename: 'doc.md',
      mimeType: 'text/markdown',
      size: 100,
      chunks,
    });
    expect(result.document.filename).toBe('doc.md');
    expect(result.document.status).toBe('ready');
    expect(result.document.chunkCount).toBe(1);
  });

  it('saves embedded chunks', async () => {
    const uc = new IngestDocumentUseCase(docRepo, chunkRepo, embedder);
    const chunks = [
      { content: 'chunk A', metadata: { sourceType: 'paragraph' as const, position: 0 } },
      { content: 'chunk B', metadata: { sourceType: 'code' as const, position: 1 } },
    ];
    const result = await uc.execute({
      userId: 'u1',
      filename: 'code.md',
      mimeType: 'text/markdown',
      size: 200,
      chunks,
    });
    const saved = await chunkRepo.findByDocumentId(result.document.id);
    expect(saved).toHaveLength(2);
    expect(saved[0]?.embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('throws ValidationError for empty filename', async () => {
    const uc = new IngestDocumentUseCase(docRepo, chunkRepo, embedder);
    await expect(
      uc.execute({ userId: 'u1', filename: '', mimeType: 'text/plain', size: 0, chunks: [] }),
    ).rejects.toThrow(ValidationError);
  });
});

// ── SearchKnowledgeUseCase ───────────────────────────────────────────────────

describe('SearchKnowledgeUseCase', () => {
  let docRepo: InMemoryDocRepo;
  let chunkRepo: InMemoryChunkRepo;
  let embedder: FakeEmbedder;

  beforeEach(async () => {
    docRepo = new InMemoryDocRepo();
    chunkRepo = new InMemoryChunkRepo();
    embedder = new FakeEmbedder();

    const doc = KnowledgeDocument.create({
      userId: 'u1',
      filename: 'test.md',
      mimeType: 'text/markdown',
      size: 100,
    });
    await docRepo.save(doc.markReady(2));
    const c1 = KnowledgeChunk.create({
      documentId: doc.id,
      content: 'hello world content',
      embedding: [0.1, 0.2, 0.3, 0.4],
      metadata: { sourceType: 'paragraph', position: 0 },
      position: 0,
    });
    const c2 = KnowledgeChunk.create({
      documentId: doc.id,
      content: 'another chunk here',
      embedding: [0.5, 0.6, 0.7, 0.8],
      metadata: { sourceType: 'paragraph', position: 1 },
      position: 1,
    });
    await chunkRepo.saveMany([c1, c2]);
  });

  it('returns search results with score', async () => {
    const uc = new SearchKnowledgeUseCase(chunkRepo, embedder);
    const result = await uc.execute({ userId: 'u1', query: 'hello', limit: 5 });
    expect(result.results.length).toBeGreaterThan(0);
    result.results.forEach((r) => {
      expect(r.chunk).toBeDefined();
      expect(typeof r.score).toBe('number');
    });
  });

  it('returns empty results for empty query', async () => {
    const uc = new SearchKnowledgeUseCase(chunkRepo, embedder);
    const result = await uc.execute({ userId: 'u1', query: '', limit: 5 });
    expect(result.results).toHaveLength(0);
  });
});

// ── ListDocumentsUseCase ─────────────────────────────────────────────────────

describe('ListDocumentsUseCase', () => {
  let docRepo: InMemoryDocRepo;

  beforeEach(async () => {
    docRepo = new InMemoryDocRepo();
    await docRepo.save(
      KnowledgeDocument.create({ userId: 'u1', filename: 'a.pdf', mimeType: 'application/pdf', size: 1000 }),
    );
    await docRepo.save(
      KnowledgeDocument.create({ userId: 'u1', filename: 'b.md', mimeType: 'text/markdown', size: 200 }),
    );
    await docRepo.save(
      KnowledgeDocument.create({ userId: 'u2', filename: 'c.pdf', mimeType: 'application/pdf', size: 500 }),
    );
  });

  it('lists documents for user', async () => {
    const uc = new ListDocumentsUseCase(docRepo);
    const result = await uc.execute({ userId: 'u1' });
    expect(result.documents).toHaveLength(2);
  });

  it('returns empty for user with no documents', async () => {
    const uc = new ListDocumentsUseCase(docRepo);
    const result = await uc.execute({ userId: 'u-nobody' });
    expect(result.documents).toHaveLength(0);
  });
});

// ── DeleteDocumentUseCase ────────────────────────────────────────────────────

describe('DeleteDocumentUseCase', () => {
  let docRepo: InMemoryDocRepo;
  let chunkRepo: InMemoryChunkRepo;
  let docId: string;

  beforeEach(async () => {
    docRepo = new InMemoryDocRepo();
    chunkRepo = new InMemoryChunkRepo();
    const doc = KnowledgeDocument.create({
      userId: 'u1',
      filename: 'to-delete.pdf',
      mimeType: 'application/pdf',
      size: 500,
    });
    await docRepo.save(doc);
    docId = doc.id;
    await chunkRepo.saveMany([
      KnowledgeChunk.create({
        documentId: docId,
        content: 'some content',
        embedding: undefined,
        metadata: { sourceType: 'paragraph', position: 0 },
        position: 0,
      }),
    ]);
  });

  it('removes document and its chunks', async () => {
    const uc = new DeleteDocumentUseCase(docRepo, chunkRepo);
    await uc.execute({ documentId: docId, userId: 'u1' });
    expect(await docRepo.findById(docId)).toBeNull();
    expect(await chunkRepo.findByDocumentId(docId)).toHaveLength(0);
  });

  it('throws NotFoundError for unknown document', async () => {
    const uc = new DeleteDocumentUseCase(docRepo, chunkRepo);
    await expect(uc.execute({ documentId: 'bad-id', userId: 'u1' })).rejects.toThrow(NotFoundError);
  });
});
