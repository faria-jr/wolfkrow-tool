import { randomUUID } from 'node:crypto';

export type MemorySource = 'conversation' | 'compaction' | 'user' | 'agent';

export interface SemanticMemoryProps {
  id: string;
  userId: string;
  content: string;
  embedding: number[] | undefined;
  source: MemorySource;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date | undefined;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type SemanticMemoryCreateInput = Omit<
  SemanticMemoryProps,
  'id' | 'accessCount' | 'lastAccessedAt' | 'createdAt'
>;

export class SemanticMemory {
  readonly id: string;
  readonly userId: string;
  readonly content: string;
  readonly embedding: number[] | undefined;
  readonly source: MemorySource;
  readonly importance: number;
  readonly accessCount: number;
  readonly lastAccessedAt: Date | undefined;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;

  private constructor(props: SemanticMemoryProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.content = props.content;
    this.embedding = props.embedding;
    this.source = props.source;
    this.importance = Math.max(0, Math.min(100, props.importance));
    this.accessCount = props.accessCount;
    this.lastAccessedAt = props.lastAccessedAt;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
  }

  static create(input: SemanticMemoryCreateInput): SemanticMemory {
    return new SemanticMemory({
      ...input,
      id: randomUUID(),
      accessCount: 0,
      lastAccessedAt: undefined,
      createdAt: new Date(),
    });
  }

  static fromProps(props: SemanticMemoryProps): SemanticMemory {
    return new SemanticMemory(props);
  }

  toProps(): SemanticMemoryProps {
    return {
      id: this.id,
      userId: this.userId,
      content: this.content,
      embedding: this.embedding,
      source: this.source,
      importance: this.importance,
      accessCount: this.accessCount,
      lastAccessedAt: this.lastAccessedAt,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }

  withEmbedding(embedding: number[]): SemanticMemory {
    return SemanticMemory.fromProps({ ...this.toProps(), embedding });
  }

  accessed(now = new Date()): SemanticMemory {
    return SemanticMemory.fromProps({
      ...this.toProps(),
      accessCount: this.accessCount + 1,
      lastAccessedAt: now,
    });
  }
}
