import type { ScheduledTaskRepo } from '@wolfkrow/domain';
import { CronExpression, ScheduledTask } from '@wolfkrow/domain';

export interface CreateScheduledTaskInput {
  userId: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  prompt: string;
  agentId?: string;
  tags?: string[];
}

export interface CreateScheduledTaskOutput {
  task: ScheduledTask;
}

export class CreateScheduledTaskUseCase {
  constructor(private readonly repo: ScheduledTaskRepo) {}

  async execute(input: CreateScheduledTaskInput): Promise<CreateScheduledTaskOutput> {
    CronExpression.create(input.cronExpression);
    const task = ScheduledTask.create({
      userId: input.userId,
      name: input.name,
      description: input.description,
      cronExpression: input.cronExpression,
      timezone: input.timezone ?? 'UTC',
      prompt: input.prompt,
      agentId: input.agentId,
      enabled: true,
      lastRunAt: undefined,
      nextRunAt: undefined,
      config: {},
      tags: input.tags ?? [],
    });
    const saved = await this.repo.save(task);
    return { task: saved };
  }
}
