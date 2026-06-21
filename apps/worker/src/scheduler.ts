/**
 * Cron scheduler engine
 *
 * Polls the database for due scheduled tasks and executes them.
 */

import type { ScheduledTasksRepository } from '@wolfkrow/infra/repos';
import { parseExpression } from 'cron-parser';

import type { Logger } from './logger';

export interface Task {
  id: string;
  name: string;
  cronExpression: string;
  prompt: string;
  agentId: string | undefined;
}

export interface TaskExecutor {
  execute(task: { id: string; name: string; prompt: string; agentId: string | undefined }): Promise<{
    status: 'awaiting_review' | 'validated' | 'rejected';
    output?: Record<string, unknown>;
    error?: string;
  }>;
}

export interface SchedulerOptions {
  repository: ScheduledTasksRepository;
  executor: TaskExecutor;
  logger: Logger;
  pollIntervalMs?: number;
  now?: () => Date;
  generateId?: () => string;
}

export class Scheduler {
  private readonly repository: ScheduledTasksRepository;
  private readonly executor: TaskExecutor;
  private readonly logger: Logger;
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SchedulerOptions) {
    this.repository = options.repository;
    this.executor = options.executor;
    this.logger = options.logger;
    this.pollIntervalMs = options.pollIntervalMs ?? 60_000;
    this.now = options.now ?? (() => new Date());
    this.generateId = options.generateId ?? (() => crypto.randomUUID());
  }

  start(): void {
    if (this.timer) {
      this.logger.warn('Scheduler already running');
      return;
    }

    this.logger.info('Starting scheduler');
    this.timer = setInterval(() => this.tick(), this.pollIntervalMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('Scheduler stopped');
    }
  }

  async tick(): Promise<void> {
    const now = this.now();
    this.logger.debug({ now: now.toISOString() }, 'Scheduler tick');

    const tasks = this.repository.findEnabledTasksDueBy(now);
    if (tasks.length === 0) return;

    this.logger.info({ count: tasks.length }, 'Processing due tasks');

    for (const task of tasks) {
      await this.runTask(task);
    }
  }

  private async runTask(task: {
    id: string;
    name: string;
    cronExpression: string;
    prompt: string;
    agentId: string | null | undefined;
  }): Promise<void> {
    const runId = this.generateId();
    const startedAt = this.now();

    this.logger.info({ taskId: task.id, runId }, 'Running scheduled task');

    this.repository.createRun({
      id: runId,
      taskId: task.id,
      status: 'running',
      startedAt: startedAt,
    });

    try {
      const result = await this.executor.execute({
        id: task.id,
        name: task.name,
        prompt: task.prompt,
        agentId: task.agentId ?? undefined,
      });

      this.repository.completeRun(runId, {
        status: result.status,
        completedAt: this.now(),
        ...(result.output !== undefined && { output: result.output }),
        ...(result.error !== undefined && { error: result.error }),
      });

      const nextRunAt = this.getNextRunAt(task.cronExpression, startedAt);
      this.repository.updateNextRun(task.id, nextRunAt);

      this.logger.info({ taskId: task.id, runId, status: result.status }, 'Task completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.repository.completeRun(runId, {
        status: 'rejected',
        completedAt: this.now(),
        error: message,
      });
      this.logger.error({ taskId: task.id, runId, err: error }, 'Task failed');
    }
  }

  private getNextRunAt(cronExpression: string, startDate: Date): Date {
    const interval = parseExpression(cronExpression, { utc: true, currentDate: startDate });
    return interval.next().toDate();
  }
}
