import type { EmbeddingPort, MemorySource, SemanticMemoryRepo } from '@wolfkrow/domain';
import { SemanticMemory } from '@wolfkrow/domain';

export interface AddMemoryInput {
  userId: string;
  content: string;
  source: MemorySource;
  importance: number;
  metadata?: Record<string, unknown>;
}

export interface AddMemoryOutput {
  memory: SemanticMemory;
}

export class AddMemoryUseCase {
  constructor(
    private readonly repo: SemanticMemoryRepo,
    private readonly embedder: EmbeddingPort
  ) {}

  async execute(input: AddMemoryInput): Promise<AddMemoryOutput> {
    const embedding = await this.embedder.embed(input.content);
    const memory = SemanticMemory.create({
      userId: input.userId,
      content: input.content,
      source: input.source,
      importance: input.importance,
      embedding,
      metadata: input.metadata ?? {},
    });
    const saved = await this.repo.save(memory);
    return { memory: saved };
  }
}
