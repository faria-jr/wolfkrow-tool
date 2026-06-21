import type { ScheduledTaskRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface DeleteScheduledTaskInput {
  taskId: string;
  userId: string;
}

export class DeleteScheduledTaskUseCase {
  constructor(private readonly repo: ScheduledTaskRepo) {}

  async execute(input: DeleteScheduledTaskInput): Promise<void> {
    const task = await this.repo.findById(input.taskId);
    if (!task || task.userId !== input.userId) {
      throw new NotFoundError('ScheduledTask', input.taskId);
    }
    await this.repo.delete(input.taskId);
  }
}
