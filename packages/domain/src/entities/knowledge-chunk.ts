import { randomUUID } from 'node:crypto';

export type ChunkSourceType = 'paragraph' | 'heading' | 'code' | 'list' | 'table' | 'raw';

export interface ChunkMetadata {
  sourceType: ChunkSourceType;
  heading?: string;
  position: number;
  [key: string]: unknown;
}

export interface KnowledgeChunkProps {
  id: string;
  documentId: string;
  content: string;
  embedding: number[] | undefined;
  metadata: ChunkMetadata;
  position: number;
  createdAt: Date;
}

export type KnowledgeChunkCreateInput = Omit<KnowledgeChunkProps, 'id' | 'createdAt'>;

export class KnowledgeChunk {
  readonly id: string;
  readonly documentId: string;
  readonly content: string;
  readonly embedding: number[] | undefined;
  readonly metadata: ChunkMetadata;
  readonly position: number;
  readonly createdAt: Date;

  private constructor(props: KnowledgeChunkProps) {
    this.id = props.id;
    this.documentId = props.documentId;
    this.content = props.content;
    this.embedding = props.embedding;
    this.metadata = props.metadata;
    this.position = props.position;
    this.createdAt = props.createdAt;
  }

  static create(input: KnowledgeChunkCreateInput): KnowledgeChunk {
    return new KnowledgeChunk({ ...input, id: randomUUID(), createdAt: new Date() });
  }

  static fromProps(props: KnowledgeChunkProps): KnowledgeChunk {
    return new KnowledgeChunk(props);
  }

  toProps(): KnowledgeChunkProps {
    return {
      id: this.id,
      documentId: this.documentId,
      content: this.content,
      embedding: this.embedding,
      metadata: this.metadata,
      position: this.position,
      createdAt: this.createdAt,
    };
  }

  withEmbedding(embedding: number[]): KnowledgeChunk {
    return KnowledgeChunk.fromProps({ ...this.toProps(), embedding });
  }
}
