import type { ScheduledTaskRepo, ScheduledTask } from '@wolfkrow/domain';
import { CronExpression, NotFoundError } from '@wolfkrow/domain';

export interface UpdateScheduledTaskInput {
  taskId: string;
  userId: string;
  name?: string;
  description?: string;
  cronExpression?: string;
  prompt?: string;
  agentId?: string;
  enabled?: boolean;
  tags?: string[];
}

export interface UpdateScheduledTaskOutput {
  task: ScheduledTask;
}

export class UpdateScheduledTaskUseCase {
  constructor(private readonly repo: ScheduledTaskRepo) {}

  async execute(input: UpdateScheduledTaskInput): Promise<UpdateScheduledTaskOutput> {
    const existing = await this.repo.findById(input.taskId);
    if (!existing || existing.userId !== input.userId) {
      throw new NotFoundError('ScheduledTask', input.taskId);
    }

    if (input.cronExpression) CronExpression.create(input.cronExpression);

    const updated = existing.withUpdate(buildPatch(input));
    const saved = await this.repo.save(updated);
    return { task: saved };
  }
}

function buildPatch(input: UpdateScheduledTaskInput): Parameters<ScheduledTask['withUpdate']>[0] {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.cronExpression !== undefined ? { cronExpression: input.cronExpression } : {}),
    ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
    ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
  };
}
