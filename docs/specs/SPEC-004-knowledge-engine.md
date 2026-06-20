# SPEC-004: Knowledge Engine (RAG Local)

**Status**: 📝 Draft
**Camada**: Worker
**Prioridade**: P0 (core feature)
**Owner**: TBD

---

## 1. Visão Geral

Engine de RAG (Retrieval-Augmented Generation) 100% local:
- Ingere PDFs, DOCX, CSV, XLSX, MD, URLs
- Chunking semântico (não fixed-size)
- Embeddings via Anthropic API
- Vector search via sqlite-vec
- Hybrid search (semantic + keyword)
- Citation inline
- Benchmark suite

---

## 2. Requisitos Funcionais

### User Stories

- **US-1**: Como usuário, quero arrastar 100 PDFs e fazer perguntas sobre eles
- **US-2**: Como usuário, quero que Wolfkrow cite fontes (chunk IDs)
- **US-3**: Como usuário, quero buscar por similaridade semântica, não keyword exato
- **US-4**: Como usuário, quero ver lista de documents ingestados
- **US-5**: Como usuário, quero deletar documents que não preciso mais
- **US-6**: Como usuário, quero re-indexar se modelo de embedding mudar

### Critérios de Aceitação

- [ ] Drag-and-drop upload (multi-file)
- [ ] Suporte: PDF, DOCX, DOC, CSV, XLSX, XLS, MD, TXT, URL
- [ ] Chunking semântico (respetar parágrafos, headings, code blocks)
- [ ] Embeddings: voyage-3 (1536 dimensions) via Anthropic API
- [ ] Vector search: cosine similarity via sqlite-vec
- [ ] Hybrid search: combine BM25 + vector (70% semantic, 30% keyword)
- [ ] Metadata filtering: date range, source type, tags
- [ ] Citation inline: [chunk_id] no response
- [ ] Progress tracking: % complete durante ingest
- [ ] Error recovery: skip bad files, continue com resto
- [ ] Re-index endpoint: regenera embeddings

---

## 3. Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│              Browser                                     │
│                                                          │
│  KnowledgePage                                           │
│  ├─ UploadDropZone (drag PDF/DOCX/etc)                   │
│  ├─ DocumentList (DataTable: title, size, status)        │
│  ├─ SearchPanel (query + filters + results)              │
│  └─ IngestProgress (SSE: real-time progress)             │
└──────────────────────────┬───────────────────────────────┘
                           │ POST /api/knowledge/*
                           ▼
┌─────────────────────────────────────────────────────────┐
│        Next.js Route Handler                              │
│                                                          │
│  POST /api/knowledge/upload (multipart)                   │
│  POST /api/knowledge/search                              │
│  GET  /api/knowledge/documents                           │
│  DELETE /api/knowledge/documents/:id                      │
│  POST /api/knowledge/reindex                             │
│  GET  /api/knowledge/ingest/stream/:id (SSE)             │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP
                           ▼
┌─────────────────────────────────────────────────────────┐
│        Worker (Node.js)                                  │
│                                                          │
│  KnowledgeEngine                                         │
│  ├─ DocParsers                                           │
│  │   ├─ PDFParser (pdf-parse)                            │
│  │   ├─ DOCXParser (mammoth)                             │
│  │   ├─ CSVParser (csv-parse)                            │
│  │   ├─ XLSXParser (xlsx)                                │
│  │   ├─ MDParser (gray-matter + remark)                  │
│  │   └─ URLParser (fetch + readability + turndown)       │
│  ├─ Chunker (semantic, Markdown-aware)                   │
│  ├─ Embedder (Anthropic Embeddings API)                  │
│  ├─ VectorSearch (sqlite-vec cosine)                     │
│  └─ KeywordSearch (FTS5 BM25)                            │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Chunking Strategy

### Semantic Chunker

```typescript
// apps/worker/src/knowledge/chunker.ts
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

interface Chunk {
  content: string;
  metadata: {
    sourceType: 'paragraph' | 'heading' | 'code' | 'list' | 'table';
    heading?: string;
    position: number;
  };
}

export function semanticChunk(content: string, maxChunkSize = 1000): Chunk[] {
  const tree = remark().use(remarkGfm).parse(content);
  const chunks: Chunk[] = [];
  
  let currentChunk = '';
  let currentHeading = '';
  
  visit(tree, (node: any) => {
    if (node.type === 'heading') {
      currentHeading = toString(node);
      // Start new chunk on heading
      if (currentChunk.length > 0) {
        chunks.push({ content: currentChunk.trim(), metadata: { ... } });
        currentChunk = '';
      }
    } else if (node.type === 'paragraph' || node.type === 'code' || node.type === 'list') {
      const text = toString(node);
      
      if (currentChunk.length + text.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: { heading: currentHeading, sourceType: 'paragraph', position: chunks.length },
        });
        currentChunk = text;
      } else {
        currentChunk += '\n\n' + text;
      }
    }
  });
  
  if (currentChunk.trim().length > 0) {
    chunks.push({ content: currentChunk.trim(), metadata: { heading: currentHeading, sourceType: 'paragraph', position: chunks.length } });
  }
  
  return chunks;
}
```

---

## 5. Embeddings

```typescript
// packages/infra/src/embeddings/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicEmbeddings {
  constructor(private apiKey: string) {}
  
  async embed(text: string): Promise<number[]> {
    const client = new Anthropic({ apiKey: this.apiKey });
    
    const response = await client.embeddings.create({
      model: 'voyage-3',
      input: text,
    });
    
    return response.embedding;
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    const client = new Anthropic({ apiKey: this.apiKey });
    
    const response = await client.embeddings.create({
      model: 'voyage-3',
      input: texts,
    });
    
    return response.embeddings;
  }
}
```

---

## 6. Vector Search (Hybrid)

```typescript
// apps/worker/src/knowledge/search.ts
export class HybridSearch {
  constructor(
    private db: Database,
    private embeddings: AnthropicEmbeddings,
  ) {}
  
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // 1. Generate query embedding
    const queryEmbedding = await this.embeddings.embed(query);
    
    // 2. Vector search (semantic)
    const vectorResults = await this.vectorSearch(queryEmbedding, options);
    
    // 3. Keyword search (BM25 via FTS5)
    const keywordResults = await this.keywordSearch(query, options);
    
    // 4. Reciprocal Rank Fusion (RRF)
    const fused = this.fuse(vectorResults, keywordResults, {
      vectorWeight: 0.7,
      keywordWeight: 0.3,
    });
    
    return fused.slice(0, options.limit ?? 10);
  }
  
  private async vectorSearch(embedding: number[], options: SearchOptions) {
    const sql = sql`
      SELECT 
        kc.id,
        kc.document_id,
        kc.content,
        kc.metadata,
        vec_distance_cosine(kc.embedding, ${JSON.stringify(embedding)}) AS distance
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kd.status = 'ready'
        ${options.documentIds ? sql`AND kc.document_id IN ${options.documentIds}` : sql``}
      ORDER BY distance
      LIMIT ${(options.limit ?? 10) * 2}
    `;
    
    return this.db.all(sql);
  }
  
  private async keywordSearch(query: string, options: SearchOptions) {
    const sql = sql`
      SELECT 
        kc.id,
        kc.document_id,
        kc.content,
        kc.metadata,
        bm25(knowledge_chunks_fts) AS rank
      FROM knowledge_chunks_fts
      JOIN knowledge_chunks kc ON kc.id = knowledge_chunks_fts.rowid
      WHERE knowledge_chunks_fts MATCH ${query}
      ORDER BY rank
      LIMIT ${(options.limit ?? 10) * 2}
    `;
    
    return this.db.all(sql);
  }
  
  private fuse(vectorResults: any[], keywordResults: any[], weights: { vectorWeight: number; keywordWeight: number }) {
    const scores = new Map<string, number>();
    
    vectorResults.forEach((r, i) => {
      const score = (1 / (i + 1)) * weights.vectorWeight;
      scores.set(r.id, (scores.get(r.id) ?? 0) + score);
    });
    
    keywordResults.forEach((r, i) => {
      const score = (1 / (i + 1)) * weights.keywordWeight;
      scores.set(r.id, (scores.get(r.id) ?? 0) + score);
    });
    
    return Array.from(scores.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([id]) => vectorResults.find((r) => r.id === id) ?? keywordResults.find((r) => r.id === id));
  }
}
```

---

## 7. Database Schema

```typescript
export const knowledgeDocuments = sqliteTable('knowledge_documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  status: text('status', { enum: ['pending', 'processing', 'ready', 'failed'] }).notNull(),
  error: text('error'),
  metadata: text('metadata', { mode: 'json' }).$type<DocumentMetadata>().default({}),
  chunkCount: integer('chunk_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const knowledgeChunks = sqliteTable('knowledge_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  embedding: text('embedding', { mode: 'json' }).$type<number[]>(), // sqlite-vec will handle
  metadata: text('metadata', { mode: 'json' }).$type<ChunkMetadata>().default({}),
  position: integer('position').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

---

## 8. Ingest Pipeline

```typescript
// apps/worker/src/knowledge/ingest.ts
export class IngestPipeline {
  constructor(
    private parsers: DocParsers,
    private chunker: Chunker,
    private embeddings: AnthropicEmbeddings,
    private docRepo: KnowledgeDocRepo,
    private chunkRepo: KnowledgeChunkRepo,
    private events: EventBus,
  ) {}
  
  async ingest(file: UploadedFile, onProgress?: (progress: IngestProgress) => void): Promise<KnowledgeDocument> {
    // 1. Create document record
    const doc = await this.docRepo.create({
      filename: file.name,
      mimeType: file.mimeType,
      size: file.size,
      status: 'processing',
    });
    
    onProgress?.({ stage: 'parsing', progress: 0 });
    this.events.publish(new DocumentIngestStartedEvent(doc.id));
    
    try {
      // 2. Parse file
      const parser = this.parsers.forMimeType(file.mimeType);
      const content = await parser.parse(file.path);
      
      onProgress?.({ stage: 'chunking', progress: 0.3 });
      
      // 3. Chunk semantically
      const chunks = this.chunker.chunk(content);
      
      onProgress?.({ stage: 'embedding', progress: 0.5 });
      
      // 4. Generate embeddings (batched)
      const batchSize = 100;
      const embeddings: number[][] = [];
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchEmbeddings = await this.embeddings.embedBatch(batch.map((c) => c.content));
        embeddings.push(...batchEmbeddings);
        
        onProgress?.({
          stage: 'embedding',
          progress: 0.5 + (0.4 * (i + batch.length) / chunks.length),
        });
      }
      
      // 5. Save chunks
      onProgress?.({ stage: 'saving', progress: 0.9 });
      
      await this.chunkRepo.saveMany(
        chunks.map((chunk, i) => ({
          documentId: doc.id,
          content: chunk.content,
          embedding: embeddings[i],
          metadata: chunk.metadata,
          position: i,
        })),
      );
      
      // 6. Mark as ready
      const updated = await this.docRepo.update(doc.id, {
        status: 'ready',
        chunkCount: chunks.length,
      });
      
      onProgress?.({ stage: 'done', progress: 1 });
      this.events.publish(new DocumentIngestCompletedEvent(doc.id, chunks.length));
      
      return updated;
    } catch (error) {
      await this.docRepo.update(doc.id, {
        status: 'failed',
        error: String(error),
      });
      
      this.events.publish(new DocumentIngestFailedEvent(doc.id, String(error)));
      throw error;
    }
  }
}
```

---

## 9. Performance Targets

| Metric | Target |
|---|---|
| Ingest 100 PDFs (avg 50 pages) | <5min |
| Embedding generation | 100 chunks/sec |
| Vector search (10k chunks) | <50ms |
| Hybrid search (10k chunks) | <100ms |
| Citation generation | <10ms |

---

## 10. Testes

### Unit
- Parser per format (PDF, DOCX, etc)
- Semantic chunker edge cases
- RRF algorithm
- Embedding batch processing

### Integration
- Full ingest pipeline
- Search across multiple documents
- Metadata filtering
- Re-index workflow

### E2E
- User uploads PDF → search → results
- Citation inline rendering
- Document deletion cascade
