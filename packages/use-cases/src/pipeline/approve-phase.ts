import type { PipelinePhase, PipelineProject, PipelinePhaseRepo, PipelineProjectRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface ApprovePipelinePhaseInput {
  projectId: string;
  phaseId: string;
  approved: boolean;
  notes?: string;
}

export interface ApprovePipelinePhaseOutput {
  project: PipelineProject;
  phase: PipelinePhase;
}

export class ApprovePipelinePhaseUseCase {
  constructor(private readonly projectRepo: PipelineProjectRepo, private readonly phaseRepo: PipelinePhaseRepo) {}

  async execute(input: ApprovePipelinePhaseInput): Promise<ApprovePipelinePhaseOutput> {
    const [project, phase] = await Promise.all([
      this.projectRepo.findById(input.projectId),
      this.phaseRepo.findById(input.phaseId),
    ]);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);
    if (!phase) throw new NotFoundError('PipelinePhase', input.phaseId);

    const updatedPhase = await this.phaseRepo.save(input.approved ? phase.complete() : phase.fail());

    const updatedProject = await this.projectRepo.save(
      input.approved
        ? project.withStage('implementation', { status: 'running', ...(input.notes !== undefined ? { approvalNotes: input.notes } : {}) })
        : project.withStatus('paused'),
    );

    return { project: updatedProject, phase: updatedPhase };
  }
}
