import type {
  ChunkMetadata,
  EmbeddingPort,
  KnowledgeChunkRepo,
  KnowledgeDocRepo,
} from '@wolfkrow/domain';
import { KnowledgeChunk, KnowledgeDocument } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface ChunkInput {
  content: string;
  metadata: ChunkMetadata;
}

export interface IngestDocumentInput {
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  chunks: ChunkInput[];
  embeddingModel?: 'voyage-3' | 'voyage-3-lite' | 'voyage-large-2';
}

export interface IngestDocumentOutput {
  document: KnowledgeDocument;
}

export class IngestDocumentUseCase implements UseCase<IngestDocumentInput, IngestDocumentOutput> {
  constructor(
    private readonly docRepo: KnowledgeDocRepo,
    private readonly chunkRepo: KnowledgeChunkRepo,
    private readonly embedder: EmbeddingPort
  ) {}

  async execute(input: IngestDocumentInput): Promise<IngestDocumentOutput> {
    let doc = KnowledgeDocument.create({
      userId: input.userId,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
    });
    doc = await this.docRepo.save(doc.markProcessing());

    const batchSize = 100;
    const allChunks: KnowledgeChunk[] = [];

    for (let i = 0; i < input.chunks.length; i += batchSize) {
      const batch = input.chunks.slice(i, i + batchSize);
      const embeddings = await this.embedder.embedBatch(batch.map((c) => c.content));
      const chunks = batch.map((c, j) =>
        KnowledgeChunk.create({
          documentId: doc.id,
          content: c.content,
          embedding: embeddings[j],
          metadata: c.metadata,
          position: i + j,
        })
      );
      allChunks.push(...chunks);
    }

    if (allChunks.length > 0) await this.chunkRepo.saveMany(allChunks);

    const model = input.embeddingModel ?? 'voyage-3';
    doc = await this.docRepo.save(doc.markReady(allChunks.length, model));

    return { document: doc };
  }
}
