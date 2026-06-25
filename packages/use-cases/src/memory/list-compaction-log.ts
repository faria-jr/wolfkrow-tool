import type { CompactionLogRepo } from '@wolfkrow/domain';
import type { CompactionLog } from '@wolfkrow/domain';

export interface ListCompactionLogInput {
  userId: string;
  limit?: number;
}

export interface ListCompactionLogOutput {
  log: CompactionLog[];
}

/**
 * Returns dreaming/compaction history for the UI (FE-3).
 */
export class ListCompactionLogUseCase {
  constructor(private readonly repo: CompactionLogRepo) {}

  async execute(input: ListCompactionLogInput): Promise<ListCompactionLogOutput> {
    const log = await this.repo.findByUserId(input.userId, input.limit);
    return { log };
  }
}
