import type { WorkflowRun } from '../entities/workflow-run';

export interface WorkflowRunRepo {
  findById(id: string): Promise<WorkflowRun | null>;
  findByUserId(userId: string, limit?: number): Promise<WorkflowRun[]>;
  save(run: WorkflowRun): Promise<WorkflowRun>;
}
