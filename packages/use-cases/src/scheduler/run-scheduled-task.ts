import type { ScheduledTaskRepo, TaskRunRepo } from '@wolfkrow/domain';
import { NotFoundError, TaskRun } from '@wolfkrow/domain';

export interface TaskExecutor {
  execute(task: { id: string; name: string; prompt: string; agentId: string | undefined }): Promise<{
    status: 'awaiting_review' | 'validated' | 'rejected';
    output?: Record<string, unknown>;
    error?: string;
  }>;
}

export interface RunScheduledTaskInput {
  taskId: string;
}

export interface RunScheduledTaskOutput {
  run: TaskRun;
}

export class RunScheduledTaskUseCase {
  constructor(
    private readonly taskRepo: ScheduledTaskRepo,
    private readonly runRepo: TaskRunRepo,
    private readonly executor: TaskExecutor,
  ) {}

  async execute(input: RunScheduledTaskInput): Promise<RunScheduledTaskOutput> {
    const task = await this.taskRepo.findById(input.taskId);
    if (!task) throw new NotFoundError('ScheduledTask', input.taskId);

    let run = await this.runRepo.save(TaskRun.create({ taskId: task.id }).start());

    try {
      const result = await this.executor.execute({
        id: task.id, name: task.name, prompt: task.prompt, agentId: task.agentId,
      });

      run = await this.runRepo.save(
        run.complete(result.status, {
          ...(result.output !== undefined ? { output: result.output } : {}),
          ...(result.error !== undefined ? { error: result.error } : {}),
        }),
      );

      const now = new Date();
      await this.taskRepo.save(task.withNextRun(now, now));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      run = await this.runRepo.save(run.complete('rejected', { error: message }));
    }

    return { run };
  }
}
