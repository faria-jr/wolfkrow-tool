import type { PipelinePhase } from '../entities/pipeline-phase';
import type { PipelineProject } from '../entities/pipeline-project';

export interface PipelineProjectRepo {
  findById(id: string): Promise<PipelineProject | null>;
  findByUserId(userId: string): Promise<PipelineProject[]>;
  save(project: PipelineProject): Promise<PipelineProject>;
  delete(id: string): Promise<void>;
}

export interface PipelinePhaseRepo {
  findById(id: string): Promise<PipelinePhase | null>;
  findByProjectId(projectId: string): Promise<PipelinePhase[]>;
  save(phase: PipelinePhase): Promise<PipelinePhase>;
}
