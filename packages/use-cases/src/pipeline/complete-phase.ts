import type { PipelinePhase, PipelineProject, PipelinePhaseRepo, PipelineProjectRepo, PipelineStage } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

const NEXT_STAGE: Record<PipelineStage, PipelineStage | null> = {
  discovery: 'spec_build',
  spec_build: 'spec_validate',
  spec_validate: 'approval',
  approval: 'design',
  design: 'design_lock',
  design_lock: 'implementation',
  implementation: 'completed',
  completed: null,
};

export interface CompletePhaseInput {
  phaseId: string;
  projectId: string;
  artifactPath?: string;
  tokens?: number;
  /** USD cents spent on this phase. Defaults to 0 for backwards compat. */
  cost?: number;
}
export interface CompletePhaseOutput { phase: PipelinePhase; project: PipelineProject; }

export class CompletePhaseUseCase {
  constructor(private readonly projectRepo: PipelineProjectRepo, private readonly phaseRepo: PipelinePhaseRepo) {}

  async execute(input: CompletePhaseInput): Promise<CompletePhaseOutput> {
    const [project, phase] = await Promise.all([
      this.projectRepo.findById(input.projectId),
      this.phaseRepo.findById(input.phaseId),
    ]);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);
    if (!phase) throw new NotFoundError('PipelinePhase', input.phaseId);

    const completed = await this.phaseRepo.save(
      phase.complete(input.artifactPath, input.tokens, undefined, input.cost ?? 0),
    );

    const nextStage = NEXT_STAGE[phase.stage];
    const updatedProject = await this.projectRepo.save(
      nextStage
        ? project.withStage(nextStage)
        : project.withStatus('completed', new Date()),
    );

    return { phase: completed, project: updatedProject };
  }
}
