import type { WorkflowRunRepo } from '@wolfkrow/domain';
import { WorkflowRun, NotFoundError } from '@wolfkrow/domain';
import { describe, expect, it, vi } from 'vitest';

import {
  CreateWorkflowRunUseCase,
  GetWorkflowRunUseCase,
  ListWorkflowRunsUseCase,
  ExecuteWorkflowRunUseCase,
} from '../index';

class InMemoryWorkflowRepo implements WorkflowRunRepo {
  readonly store = new Map<string, WorkflowRun>();
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByUserId(userId: string, limit?: number) {
    const all = [...this.store.values()].filter((r) => r.userId === userId);
    return limit ? all.slice(0, limit) : all;
  }
  async save(r: WorkflowRun) {
    this.store.set(r.id, r);
    return r;
  }
}

describe('CreateWorkflowRunUseCase', () => {
  it('creates run in pending state', async () => {
    const repo = new InMemoryWorkflowRepo();
    const { run } = await new CreateWorkflowRunUseCase(repo).execute({
      userId: 'u1',
      workflowName: 'test-flow',
      input: { key: 'value' },
    });
    expect(run.status).toBe('pending');
    expect(run.workflowName).toBe('test-flow');
  });
});

describe('GetWorkflowRunUseCase', () => {
  it('returns run', async () => {
    const repo = new InMemoryWorkflowRepo();
    const r = await repo.save(WorkflowRun.create({ userId: 'u1', workflowName: 'wf', input: {} }));
    const { run } = await new GetWorkflowRunUseCase(repo).execute({ runId: r.id });
    expect(run.id).toBe(r.id);
  });

  it('throws NotFoundError', async () => {
    await expect(
      new GetWorkflowRunUseCase(new InMemoryWorkflowRepo()).execute({ runId: 'x' })
    ).rejects.toThrow(NotFoundError);
  });
});

describe('ListWorkflowRunsUseCase', () => {
  it('lists runs for user', async () => {
    const repo = new InMemoryWorkflowRepo();
    await repo.save(WorkflowRun.create({ userId: 'u1', workflowName: 'a', input: {} }));
    await repo.save(WorkflowRun.create({ userId: 'u2', workflowName: 'b', input: {} }));
    const { runs } = await new ListWorkflowRunsUseCase(repo).execute({ userId: 'u1' });
    expect(runs).toHaveLength(1);
  });
});

describe('ExecuteWorkflowRunUseCase', () => {
  it('executes workflow and marks completed', async () => {
    const repo = new InMemoryWorkflowRepo();
    const r = await repo.save(
      WorkflowRun.create({ userId: 'u1', workflowName: 'test', input: { x: 1 } })
    );
    const mockExecutor = {
      execute: vi.fn().mockResolvedValue({ output: { result: 42 }, stepCount: 3 }),
    };

    const { run } = await new ExecuteWorkflowRunUseCase(repo, mockExecutor).execute({
      runId: r.id,
    });
    expect(run.status).toBe('completed');
    expect(run.output).toEqual({ result: 42 });
    expect(run.metrics.stepCount).toBe(3);
  });

  it('marks run failed on executor error', async () => {
    const repo = new InMemoryWorkflowRepo();
    const r = await repo.save(
      WorkflowRun.create({ userId: 'u1', workflowName: 'test', input: {} })
    );
    const mockExecutor = { execute: vi.fn().mockRejectedValue(new Error('Timeout')) };

    const { run } = await new ExecuteWorkflowRunUseCase(repo, mockExecutor).execute({
      runId: r.id,
    });
    expect(run.status).toBe('failed');
    expect(run.error).toBe('Timeout');
  });
});
