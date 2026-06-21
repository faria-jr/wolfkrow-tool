import { randomUUID } from 'node:crypto';

import { ValidationError } from '../errors/domain-error';

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type EmbeddingModel = 'voyage-3' | 'voyage-3-lite' | 'voyage-large-2';

export interface DocumentMetadata {
  tags?: string[];
  source?: string;
  title?: string;
  [key: string]: unknown;
}

export interface KnowledgeDocumentProps {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  error: string | undefined;
  embeddingModel: EmbeddingModel | undefined;
  metadata: DocumentMetadata;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type KnowledgeDocumentCreateInput = Pick<
  KnowledgeDocumentProps,
  'userId' | 'filename' | 'mimeType' | 'size'
> & { metadata?: DocumentMetadata };

export class KnowledgeDocument {
  readonly id: string;
  readonly userId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
  readonly status: DocumentStatus;
  readonly error: string | undefined;
  readonly embeddingModel: EmbeddingModel | undefined;
  readonly metadata: DocumentMetadata;
  readonly chunkCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: KnowledgeDocumentProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.filename = props.filename;
    this.mimeType = props.mimeType;
    this.size = props.size;
    this.status = props.status;
    this.error = props.error;
    this.embeddingModel = props.embeddingModel;
    this.metadata = props.metadata;
    this.chunkCount = props.chunkCount;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: KnowledgeDocumentCreateInput): KnowledgeDocument {
    if (!input.filename.trim()) throw new ValidationError('filename', 'Filename is required');
    if (input.size < 0) throw new ValidationError('size', 'Size must be non-negative');
    const now = new Date();
    return new KnowledgeDocument({
      id: randomUUID(),
      userId: input.userId,
      filename: input.filename.trim(),
      mimeType: input.mimeType,
      size: input.size,
      status: 'pending',
      error: undefined,
      embeddingModel: undefined,
      metadata: input.metadata ?? {},
      chunkCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: KnowledgeDocumentProps): KnowledgeDocument {
    return new KnowledgeDocument(props);
  }

  toProps(): KnowledgeDocumentProps {
    return {
      id: this.id,
      userId: this.userId,
      filename: this.filename,
      mimeType: this.mimeType,
      size: this.size,
      status: this.status,
      error: this.error,
      embeddingModel: this.embeddingModel,
      metadata: this.metadata,
      chunkCount: this.chunkCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  markProcessing(): KnowledgeDocument {
    return KnowledgeDocument.fromProps({
      ...this.toProps(),
      status: 'processing',
      error: undefined,
      updatedAt: new Date(),
    });
  }

  markReady(chunkCount: number, embeddingModel: EmbeddingModel = 'voyage-3'): KnowledgeDocument {
    return KnowledgeDocument.fromProps({
      ...this.toProps(),
      status: 'ready',
      chunkCount,
      embeddingModel,
      error: undefined,
      updatedAt: new Date(),
    });
  }

  markFailed(error: string): KnowledgeDocument {
    return KnowledgeDocument.fromProps({
      ...this.toProps(),
      status: 'failed',
      error,
      updatedAt: new Date(),
    });
  }

  isReady(): boolean {
    return this.status === 'ready';
  }
}
