/**
 * Knowledge schemas — documents, chunks, embeddings, RAG
 */

import { z } from 'zod';

import {
  MetadataSchema,
  NonEmptyStringSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const DocumentStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const ChunkSourceTypeSchema = z.enum(['paragraph', 'heading', 'code', 'list', 'table']);

export type ChunkSourceType = z.infer<typeof ChunkSourceTypeSchema>;

export const EmbeddingModelSchema = z.enum(['voyage-3', 'voyage-3-lite', 'voyage-large-2']);

export type EmbeddingModel = z.infer<typeof EmbeddingModelSchema>;

export const KnowledgeDocumentMetadataSchema = z
  .object({
    title: z.string().optional(),
    author: z.string().optional(),
    createdAt: TimestampSchema.optional(),
    pageCount: z.number().int().positive().optional(),
    language: z.string().optional(),
    tags: z.array(z.string()).default([]),
    source: z.string().optional(),
  })
  .and(MetadataSchema);

export type KnowledgeDocumentMetadata = z.infer<typeof KnowledgeDocumentMetadataSchema>;

/**
 * Knowledge Document
 */
export const KnowledgeDocumentSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  filename: ShortStringSchema,
  mimeType: NonEmptyStringSchema,
  size: z.number().int().positive(),
  status: DocumentStatusSchema,
  error: z.string().optional(),
  embeddingModel: EmbeddingModelSchema.optional(),
  metadata: KnowledgeDocumentMetadataSchema,
  chunkCount: z.number().int().min(0).default(0),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

/**
 * Document chunk metadata
 */
export const ChunkMetadataSchema = z
  .object({
    heading: z.string().optional(),
    position: z.number().int().min(0),
    sourceType: ChunkSourceTypeSchema,
    pageNumber: z.number().int().positive().optional(),
  })
  .and(MetadataSchema);

export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;

/**
 * Document chunk (with embedding)
 */
export const KnowledgeChunkSchema = z.object({
  id: UuidSchema,
  documentId: UuidSchema,
  content: NonEmptyStringSchema,
  embedding: z.array(z.number()).optional(),
  metadata: ChunkMetadataSchema,
  position: z.number().int().min(0),
  createdAt: TimestampSchema,
});

export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;

/**
 * Search query
 */
export const SearchQuerySchema = z.object({
  query: NonEmptyStringSchema,
  documentIds: z.array(UuidSchema).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).default(10),
  semanticWeight: z.number().min(0).max(1).default(0.7),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Search result
 */
export const SearchResultSchema = z.object({
  chunk: KnowledgeChunkSchema,
  score: z.number().min(0).max(1),
  document: KnowledgeDocumentSchema.optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
