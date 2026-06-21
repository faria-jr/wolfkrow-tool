import type { TaskRun, TaskRunRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface ReviewTaskRunInput {
  runId: string;
  verdict: 'validated' | 'rejected';
  note?: string;
}

export interface ReviewTaskRunOutput {
  run: TaskRun;
}

export class ReviewTaskRunUseCase {
  constructor(private readonly runRepo: TaskRunRepo) {}

  async execute(input: ReviewTaskRunInput): Promise<ReviewTaskRunOutput> {
    const existing = await this.runRepo.findById(input.runId);
    if (!existing) throw new NotFoundError('TaskRun', input.runId);

    const reviewed = existing.review(input.verdict, input.note);
    const saved = await this.runRepo.save(reviewed);
    return { run: saved };
  }
}
