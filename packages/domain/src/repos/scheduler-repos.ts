import type { ScheduledTask } from '../entities/scheduled-task';
import type { TaskRun } from '../entities/task-run';

export interface ScheduledTaskRepo {
  findById(id: string): Promise<ScheduledTask | null>;
  findByUserId(userId: string): Promise<ScheduledTask[]>;
  findEnabledDueBy(now: Date): Promise<ScheduledTask[]>;
  save(task: ScheduledTask): Promise<ScheduledTask>;
  delete(id: string): Promise<void>;
}

export interface TaskRunRepo {
  findById(id: string): Promise<TaskRun | null>;
  findByTaskId(taskId: string, limit?: number): Promise<TaskRun[]>;
  findAwaitingReview(userId: string): Promise<TaskRun[]>;
  save(run: TaskRun): Promise<TaskRun>;
}
