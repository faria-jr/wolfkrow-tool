import type { ScheduledTasksRepository } from '@wolfkrow/infra/repos';
import { describe, it, expect, vi } from 'vitest';

import type { Logger } from '../logger';
import { Scheduler, type TaskExecutor } from '../scheduler';

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    level: 'info',
  } as unknown as Logger;
}

function createMockRepository(
  overrides: Partial<ScheduledTasksRepository> = {}
): ScheduledTasksRepository {
  return {
    findEnabledTasksDueBy: vi.fn().mockReturnValue([]),
    updateNextRun: vi.fn(),
    disable: vi.fn(),
    createRun: vi.fn(),
    completeRun: vi.fn(),
    ...overrides,
  };
}

function createMockExecutor(overrides: Partial<TaskExecutor> = {}): TaskExecutor {
  return {
    execute: vi.fn().mockResolvedValue({ status: 'validated' as const }),
    ...overrides,
  };
}

describe('Scheduler', () => {
  it('does nothing when no tasks are due', async () => {
    const repository = createMockRepository();
    const executor = createMockExecutor();
    const logger = createMockLogger();
    const scheduler = new Scheduler({ repository, executor, logger });

    await scheduler.tick();

    expect(repository.findEnabledTasksDueBy).toHaveBeenCalledOnce();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('executes a due task and schedules the next run', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const repository = createMockRepository({
      findEnabledTasksDueBy: vi.fn().mockReturnValue([
        {
          id: 'task-1',
          name: 'Daily sync',
          cronExpression: '0 0 * * *',
          prompt: 'Run daily sync',
          agentId: null,
        },
      ]),
    });
    const executor = createMockExecutor();
    const logger = createMockLogger();
    const scheduler = new Scheduler({
      repository,
      executor,
      logger,
      now: () => now,
      generateId: () => 'run-1',
    });

    await scheduler.tick();

    expect(executor.execute).toHaveBeenCalledWith({
      id: 'task-1',
      name: 'Daily sync',
      prompt: 'Run daily sync',
      agentId: undefined,
    });
    expect(repository.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'run-1',
        taskId: 'task-1',
        status: 'running',
        startedAt: now,
      })
    );
    expect(repository.completeRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ status: 'validated' })
    );
    expect(repository.updateNextRun).toHaveBeenCalledWith(
      'task-1',
      new Date('2024-01-02T00:00:00.000Z')
    );
  });

  it('records failure when executor throws', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const repository = createMockRepository({
      findEnabledTasksDueBy: vi.fn().mockReturnValue([
        {
          id: 'task-2',
          name: 'Failing task',
          cronExpression: '0 0 * * *',
          prompt: 'Fail',
          agentId: null,
        },
      ]),
    });
    const executor = createMockExecutor({
      execute: vi.fn().mockRejectedValue(new Error('Boom')),
    });
    const logger = createMockLogger();
    const scheduler = new Scheduler({
      repository,
      executor,
      logger,
      now: () => now,
      generateId: () => 'run-2',
    });

    await scheduler.tick();

    expect(repository.completeRun).toHaveBeenCalledWith(
      'run-2',
      expect.objectContaining({ status: 'rejected', error: 'Boom' })
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
