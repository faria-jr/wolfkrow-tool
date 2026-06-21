import type { SemanticMemory, SemanticMemoryRepo } from '@wolfkrow/domain';

export interface ListMemoriesInput {
  userId: string;
  limit?: number;
}

export interface ListMemoriesOutput {
  memories: SemanticMemory[];
}

export class ListMemoriesUseCase {
  constructor(private readonly repo: SemanticMemoryRepo) {}

  async execute(input: ListMemoriesInput): Promise<ListMemoriesOutput> {
    const memories = await this.repo.findByUserId(input.userId, input.limit);
    return { memories };
  }
}
