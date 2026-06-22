import type { ScheduledTaskRepo, TaskRunRepo } from '@wolfkrow/domain';
import { ScheduledTask, TaskRun, ValidationError, NotFoundError } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CreateScheduledTaskUseCase,
  DeleteScheduledTaskUseCase,
  ListScheduledTasksUseCase,
  ReviewTaskRunUseCase,
  RunScheduledTaskUseCase,
  UpdateScheduledTaskUseCase,
} from '../index';

// ── Fakes ────────────────────────────────────────────────────────────────────

class InMemoryTaskRepo implements ScheduledTaskRepo {
  readonly store = new Map<string, ScheduledTask>();
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByUserId(userId: string) { return [...this.store.values()].filter((t) => t.userId === userId); }
  async findEnabledDueBy(now: Date) {
    return [...this.store.values()].filter((t) => t.enabled && (t.nextRunAt == null || t.nextRunAt <= now));
  }
  async save(task: ScheduledTask) { this.store.set(task.id, task); return task; }
  async delete(id: string) { this.store.delete(id); }
}

class InMemoryRunRepo implements TaskRunRepo {
  readonly store = new Map<string, TaskRun>();
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByTaskId(taskId: string) { return [...this.store.values()].filter((r) => r.taskId === taskId); }
  async save(run: TaskRun) { this.store.set(run.id, run); return run; }
}

// ── CreateScheduledTaskUseCase ────────────────────────────────────────────────

describe('CreateScheduledTaskUseCase', () => {
  let repo: InMemoryTaskRepo;

  beforeEach(() => { repo = new InMemoryTaskRepo(); });

  it('creates a scheduled task', async () => {
    const uc = new CreateScheduledTaskUseCase(repo);
    const result = await uc.execute({
      userId: 'u1',
      name: 'Daily briefing',
      cronExpression: '0 9 * * *',
      prompt: 'Summarize news',
    });
    expect(result.task.name).toBe('Daily briefing');
    expect(result.task.cronExpression).toBe('0 9 * * *');
    expect(result.task.enabled).toBe(true);
    expect(await repo.findById(result.task.id)).not.toBeNull();
  });

  it('throws ValidationError for invalid cron', async () => {
    const uc = new CreateScheduledTaskUseCase(repo);
    await expect(uc.execute({ userId: 'u1', name: 'X', cronExpression: 'not-valid', prompt: 'p' }))
      .rejects.toThrow(ValidationError);
  });
});

// ── UpdateScheduledTaskUseCase ────────────────────────────────────────────────

describe('UpdateScheduledTaskUseCase', () => {
  let repo: InMemoryTaskRepo;

  beforeEach(async () => {
    repo = new InMemoryTaskRepo();
    await repo.save(ScheduledTask.create({
      userId: 'u1', name: 'Daily', cronExpression: '0 9 * * *', prompt: 'p',
      timezone: 'UTC', enabled: true, description: undefined, agentId: undefined,
      config: {}, tags: [], lastRunAt: undefined, nextRunAt: undefined,
    }));
  });

  it('patches name and enabled', async () => {
    const uc = new UpdateScheduledTaskUseCase(repo);
    const task = [...repo.store.values()][0]!;
    const result = await uc.execute({ taskId: task.id, userId: 'u1', name: 'Weekly', enabled: false });
    expect(result.task.name).toBe('Weekly');
    expect(result.task.enabled).toBe(false);
  });

  it('throws NotFoundError for unknown id', async () => {
    const uc = new UpdateScheduledTaskUseCase(repo);
    await expect(uc.execute({ taskId: 'bad', userId: 'u1', name: 'X' })).rejects.toThrow(NotFoundError);
  });
});

// ── ListScheduledTasksUseCase ─────────────────────────────────────────────────

describe('ListScheduledTasksUseCase', () => {
  let repo: InMemoryTaskRepo;

  beforeEach(async () => {
    repo = new InMemoryTaskRepo();
    await repo.save(ScheduledTask.create({ userId: 'u1', name: 'A', cronExpression: '0 9 * * *', prompt: 'p', timezone: 'UTC', enabled: true, description: undefined, agentId: undefined, config: {}, tags: [], lastRunAt: undefined, nextRunAt: undefined }));
    await repo.save(ScheduledTask.create({ userId: 'u1', name: 'B', cronExpression: '0 10 * * *', prompt: 'p', timezone: 'UTC', enabled: false, description: undefined, agentId: undefined, config: {}, tags: [], lastRunAt: undefined, nextRunAt: undefined }));
    await repo.save(ScheduledTask.create({ userId: 'u2', name: 'C', cronExpression: '0 11 * * *', prompt: 'p', timezone: 'UTC', enabled: true, description: undefined, agentId: undefined, config: {}, tags: [], lastRunAt: undefined, nextRunAt: undefined }));
  });

  it('lists tasks for user', async () => {
    const uc = new ListScheduledTasksUseCase(repo);
    const result = await uc.execute({ userId: 'u1' });
    expect(result.tasks).toHaveLength(2);
  });
});

// ── DeleteScheduledTaskUseCase ────────────────────────────────────────────────

describe('DeleteScheduledTaskUseCase', () => {
  let repo: InMemoryTaskRepo;

  beforeEach(async () => {
    repo = new InMemoryTaskRepo();
    await repo.save(ScheduledTask.create({ userId: 'u1', name: 'A', cronExpression: '0 9 * * *', prompt: 'p', timezone: 'UTC', enabled: true, description: undefined, agentId: undefined, config: {}, tags: [], lastRunAt: undefined, nextRunAt: undefined }));
  });

  it('removes task', async () => {
    const uc = new DeleteScheduledTaskUseCase(repo);
    const task = [...repo.store.values()][0]!;
    await uc.execute({ taskId: task.id, userId: 'u1' });
    expect(await repo.findById(task.id)).toBeNull();
  });

  it('throws NotFoundError', async () => {
    const uc = new DeleteScheduledTaskUseCase(repo);
    await expect(uc.execute({ taskId: 'bad', userId: 'u1' })).rejects.toThrow(NotFoundError);
  });
});

// ── RunScheduledTaskUseCase ───────────────────────────────────────────────────

describe('RunScheduledTaskUseCase', () => {
  let taskRepo: InMemoryTaskRepo;
  let runRepo: InMemoryRunRepo;

  const mockExecutor = { execute: vi.fn().mockResolvedValue({ status: 'validated' as const, output: { content: 'ok' } }) };

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepo();
    runRepo = new InMemoryRunRepo();
    await taskRepo.save(ScheduledTask.create({ userId: 'u1', name: 'A', cronExpression: '0 9 * * *', prompt: 'go', timezone: 'UTC', enabled: true, description: undefined, agentId: undefined, config: {}, tags: [], lastRunAt: undefined, nextRunAt: undefined }));
  });

  it('executes task and saves run as validated', async () => {
    const uc = new RunScheduledTaskUseCase(taskRepo, runRepo, mockExecutor);
    const task = [...taskRepo.store.values()][0]!;
    const result = await uc.execute({ taskId: task.id });
    expect(result.run.status).toBe('validated');
    expect(await runRepo.findById(result.run.id)).not.toBeNull();
    const updated = await taskRepo.findById(task.id);
    expect(updated?.lastRunAt).toBeDefined();
  });

  it('saves run as rejected on executor error', async () => {
    const failExecutor = { execute: vi.fn().mockRejectedValue(new Error('AI down')) };
    const uc = new RunScheduledTaskUseCase(taskRepo, runRepo, failExecutor);
    const task = [...taskRepo.store.values()][0]!;
    const result = await uc.execute({ taskId: task.id });
    expect(result.run.status).toBe('rejected');
    expect(result.run.error).toBe('AI down');
  });
});

// ── ReviewTaskRunUseCase ──────────────────────────────────────────────────────

describe('ReviewTaskRunUseCase', () => {
  let taskRepo: InMemoryTaskRepo;
  let runRepo: InMemoryRunRepo;

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepo();
    runRepo = new InMemoryRunRepo();
    await taskRepo.save(ScheduledTask.create({ userId: 'u1', name: 'A', cronExpression: '0 9 * * *', prompt: 'p', timezone: 'UTC', enabled: true, description: undefined, agentId: undefined, config: {}, tags: [], lastRunAt: undefined, nextRunAt: undefined }));
    const task = [...taskRepo.store.values()][0]!;
    await runRepo.save(TaskRun.create({ taskId: task.id }).start().complete('awaiting_review', { output: { content: 'x' } }));
  });

  it('validates a run', async () => {
    const uc = new ReviewTaskRunUseCase(runRepo);
    const run = [...runRepo.store.values()][0]!;
    const result = await uc.execute({ runId: run.id, verdict: 'validated', note: 'LGTM' });
    expect(result.run.status).toBe('validated');
    expect(result.run.reviewNote).toBe('LGTM');
  });

  it('rejects a run', async () => {
    const uc = new ReviewTaskRunUseCase(runRepo);
    const run = [...runRepo.store.values()][0]!;
    const result = await uc.execute({ runId: run.id, verdict: 'rejected', note: 'bad output' });
    expect(result.run.status).toBe('rejected');
  });

  it('throws NotFoundError for unknown run', async () => {
    const uc = new ReviewTaskRunUseCase(runRepo);
    await expect(uc.execute({ runId: 'none', verdict: 'validated' })).rejects.toThrow(NotFoundError);
  });
});
