/**
 * Drizzle schema — Knowledge (documents, chunks)
 */

import { index, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const knowledgeDocuments = sqliteTable(
  'knowledge_documents',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    filename: shortText('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    status: text('status', { enum: ['pending', 'processing', 'ready', 'failed'] }).notNull(),
    error: text('error'),
    embeddingModel: text('embedding_model', {
      enum: ['voyage-3', 'voyage-3-lite', 'voyage-large-2'],
    }),
    metadata: metadata(),
    chunkCount: integer('chunk_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('knowledge_documents_user_id_idx').on(t.userId),
    statusIdx: index('knowledge_documents_status_idx').on(t.status),
  }),
);

export const knowledgeChunks = sqliteTable(
  'knowledge_chunks',
  {
    id: id(),
    documentId: text('document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: text('embedding', { mode: 'json' }).$type<number[]>(),
    metadata: metadata(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    documentIdIdx: index('knowledge_chunks_document_id_idx').on(t.documentId),
  }),
);

export const knowledgeBenchmarks = sqliteTable(
  'knowledge_benchmarks',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: shortText('name').notNull(),
    querySet: text('query_set', { mode: 'json' }).$type<unknown[]>().notNull(),
    metrics: metadata(),
    precisionAt5: integer('precision_at_5').notNull(),
    recallAt10: integer('recall_at_10').notNull(),
    mrr: integer('mrr').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('knowledge_benchmarks_user_id_idx').on(t.userId),
  }),
);
