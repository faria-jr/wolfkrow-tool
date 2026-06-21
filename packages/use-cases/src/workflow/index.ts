import type { WorkflowRun, WorkflowRunRepo } from '@wolfkrow/domain';
import { WorkflowRun as WorkflowRunEntity, NotFoundError } from '@wolfkrow/domain';

// ── Port ──────────────────────────────────────────────────────────────────────

export interface WorkflowExecutor {
  execute(run: { id: string; workflowName: string; input: Record<string, unknown> }): Promise<{
    output: Record<string, unknown>;
    stepCount: number;
  }>;
}

// ── CreateWorkflowRun ─────────────────────────────────────────────────────────

export interface CreateWorkflowRunInput { userId: string; workflowName: string; input: Record<string, unknown>; }
export class CreateWorkflowRunUseCase {
  constructor(private readonly repo: WorkflowRunRepo) {}
  async execute(input: CreateWorkflowRunInput): Promise<{ run: WorkflowRun }> {
    const run = await this.repo.save(WorkflowRunEntity.create(input));
    return { run };
  }
}

// ── GetWorkflowRun ────────────────────────────────────────────────────────────

export class GetWorkflowRunUseCase {
  constructor(private readonly repo: WorkflowRunRepo) {}
  async execute(input: { runId: string }): Promise<{ run: WorkflowRun }> {
    const run = await this.repo.findById(input.runId);
    if (!run) throw new NotFoundError('WorkflowRun', input.runId);
    return { run };
  }
}

// ── ListWorkflowRuns ──────────────────────────────────────────────────────────

export class ListWorkflowRunsUseCase {
  constructor(private readonly repo: WorkflowRunRepo) {}
  async execute(input: { userId: string; limit?: number }): Promise<{ runs: WorkflowRun[] }> {
    return { runs: await this.repo.findByUserId(input.userId, input.limit) };
  }
}

// ── ExecuteWorkflowRun ────────────────────────────────────────────────────────

export class ExecuteWorkflowRunUseCase {
  constructor(private readonly repo: WorkflowRunRepo, private readonly executor: WorkflowExecutor) {}

  async execute(input: { runId: string }): Promise<{ run: WorkflowRun }> {
    const run = await this.repo.findById(input.runId);
    if (!run) throw new NotFoundError('WorkflowRun', input.runId);

    const started = await this.repo.save(run.start());
    try {
      const result = await this.executor.execute({ id: run.id, workflowName: run.workflowName, input: run.input });
      const completed = await this.repo.save(started.complete(result.output, result.stepCount));
      return { run: completed };
    } catch (err) {
      const failed = await this.repo.save(started.fail(err instanceof Error ? err.message : String(err)));
      return { run: failed };
    }
  }
}
