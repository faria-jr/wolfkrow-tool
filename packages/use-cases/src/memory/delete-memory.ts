import type { SemanticMemoryRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface DeleteMemoryInput {
  memoryId: string;
  userId: string;
}

export class DeleteMemoryUseCase {
  constructor(private readonly repo: SemanticMemoryRepo) {}

  async execute(input: DeleteMemoryInput): Promise<void> {
    const memory = await this.repo.findById(input.memoryId);
    if (!memory || memory.userId !== input.userId) {
      throw new NotFoundError('SemanticMemory', input.memoryId);
    }
    await this.repo.delete(input.memoryId);
  }
}
