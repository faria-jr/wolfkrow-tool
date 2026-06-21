import type { ScheduledTask, ScheduledTaskRepo } from '@wolfkrow/domain';

export interface ListScheduledTasksInput {
  userId: string;
}

export interface ListScheduledTasksOutput {
  tasks: ScheduledTask[];
}

export class ListScheduledTasksUseCase {
  constructor(private readonly repo: ScheduledTaskRepo) {}

  async execute(input: ListScheduledTasksInput): Promise<ListScheduledTasksOutput> {
    const tasks = await this.repo.findByUserId(input.userId);
    return { tasks };
  }
}
