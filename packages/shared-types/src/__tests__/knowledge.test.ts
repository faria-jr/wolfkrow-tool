import { describe, expect, it } from 'vitest';

import {
  ChunkMetadataSchema,
  ChunkSourceTypeSchema,
  DocumentStatusSchema,
  EmbeddingModelSchema,
  KnowledgeChunkSchema,
  KnowledgeDocumentMetadataSchema,
  KnowledgeDocumentSchema,
  SearchQuerySchema,
  SearchResultSchema,
} from '../schemas/knowledge';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('knowledge schemas', () => {
  describe('enums', () => {
    it.each(['pending', 'processing', 'ready', 'failed'] as const)(
      'DocumentStatusSchema accepts %s',
      (v) => {
        expect(DocumentStatusSchema.parse(v)).toBe(v);
      }
    );
    it('DocumentStatusSchema rejects invalid', () => {
      expect(() => DocumentStatusSchema.parse('nope')).toThrow();
    });

    it.each(['paragraph', 'heading', 'code', 'list', 'table'] as const)(
      'ChunkSourceTypeSchema accepts %s',
      (v) => {
        expect(ChunkSourceTypeSchema.parse(v)).toBe(v);
      }
    );
    it('ChunkSourceTypeSchema rejects invalid', () => {
      expect(() => ChunkSourceTypeSchema.parse('nope')).toThrow();
    });

    it.each(['voyage-3', 'voyage-3-lite', 'voyage-large-2'] as const)(
      'EmbeddingModelSchema accepts %s',
      (v) => {
        expect(EmbeddingModelSchema.parse(v)).toBe(v);
      }
    );
    it('EmbeddingModelSchema rejects invalid', () => {
      expect(() => EmbeddingModelSchema.parse('nope')).toThrow();
    });
  });

  describe('KnowledgeDocumentMetadataSchema', () => {
    it('applies default tags and accepts metadata intersection', () => {
      const parsed = KnowledgeDocumentMetadataSchema.parse({ title: 'Doc' });
      expect(parsed.tags).toEqual([]);
    });
    it('rejects non-positive pageCount when provided', () => {
      expect(() => KnowledgeDocumentMetadataSchema.parse({ pageCount: 0 })).toThrow();
    });
  });

  describe('KnowledgeDocumentSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      filename: 'doc.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      status: 'ready' as const,
      metadata: {},
      createdAt: ts,
      updatedAt: ts,
    };
    it('accepts a valid document with default chunkCount', () => {
      expect(KnowledgeDocumentSchema.parse(valid).chunkCount).toBe(0);
    });
    it('accepts optional error / embeddingModel', () => {
      expect(() =>
        KnowledgeDocumentSchema.parse({
          ...valid,
          error: 'fail',
          embeddingModel: 'voyage-3',
        })
      ).not.toThrow();
    });
    it('rejects non-positive size', () => {
      expect(() => KnowledgeDocumentSchema.parse({ ...valid, size: 0 })).toThrow();
    });
    it('rejects empty filename', () => {
      expect(() => KnowledgeDocumentSchema.parse({ ...valid, filename: '' })).toThrow();
    });
    it('rejects invalid status', () => {
      expect(() => KnowledgeDocumentSchema.parse({ ...valid, status: 'nope' })).toThrow();
    });
  });

  describe('ChunkMetadataSchema', () => {
    it('accepts valid metadata with required position + sourceType', () => {
      expect(() =>
        ChunkMetadataSchema.parse({ position: 0, sourceType: 'paragraph' })
      ).not.toThrow();
    });
    it('rejects missing position', () => {
      expect(() => ChunkMetadataSchema.parse({ sourceType: 'code' })).toThrow();
    });
    it('rejects negative position', () => {
      expect(() => ChunkMetadataSchema.parse({ position: -1, sourceType: 'code' })).toThrow();
    });
    it('rejects invalid sourceType', () => {
      expect(() => ChunkMetadataSchema.parse({ position: 0, sourceType: 'nope' })).toThrow();
    });
  });

  describe('KnowledgeChunkSchema', () => {
    const valid = {
      id: uuid,
      documentId: uuid,
      content: 'some text',
      metadata: { position: 0, sourceType: 'paragraph' as const },
      position: 0,
      createdAt: ts,
    };
    it('accepts a valid chunk', () => {
      expect(() => KnowledgeChunkSchema.parse(valid)).not.toThrow();
    });
    it('accepts optional embedding', () => {
      expect(() => KnowledgeChunkSchema.parse({ ...valid, embedding: [0.1, 0.2] })).not.toThrow();
    });
    it('rejects empty content', () => {
      expect(() => KnowledgeChunkSchema.parse({ ...valid, content: '' })).toThrow();
    });
  });

  describe('SearchQuerySchema', () => {
    it('applies defaults for limit / semanticWeight', () => {
      const parsed = SearchQuerySchema.parse({ query: 'search' });
      expect(parsed.limit).toBe(10);
      expect(parsed.semanticWeight).toBe(0.7);
    });
    it('accepts optional documentIds / tags', () => {
      expect(() =>
        SearchQuerySchema.parse({
          query: 'q',
          documentIds: [uuid],
          tags: ['a'],
        })
      ).not.toThrow();
    });
    it('rejects empty query', () => {
      expect(() => SearchQuerySchema.parse({ query: '' })).toThrow();
    });
    it('rejects semanticWeight out of [0,1]', () => {
      expect(() => SearchQuerySchema.parse({ query: 'q', semanticWeight: 1.5 })).toThrow();
    });
    it('rejects limit over 100', () => {
      expect(() => SearchQuerySchema.parse({ query: 'q', limit: 101 })).toThrow();
    });
  });

  describe('SearchResultSchema', () => {
    const chunk = {
      id: uuid,
      documentId: uuid,
      content: 'text',
      metadata: { position: 0, sourceType: 'paragraph' as const },
      position: 0,
      createdAt: ts,
    };
    it('accepts a valid result', () => {
      expect(() => SearchResultSchema.parse({ chunk, score: 0.9 })).not.toThrow();
    });
    it('rejects score out of [0,1]', () => {
      expect(() => SearchResultSchema.parse({ chunk, score: 1.5 })).toThrow();
    });
  });
});
