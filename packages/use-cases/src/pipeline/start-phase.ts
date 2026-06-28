import type {
  PipelinePhase,
  PipelinePhaseRepo,
  PipelineProjectRepo,
  PipelineStage,
} from '@wolfkrow/domain';
import { PipelinePhase as PipelinePhaseEntity, NotFoundError } from '@wolfkrow/domain';

export interface StartPhaseInput {
  projectId: string;
  stage: PipelineStage;
}
export interface StartPhaseOutput {
  phase: PipelinePhase;
}

export class StartPhaseUseCase {
  constructor(
    private readonly projectRepo: PipelineProjectRepo,
    private readonly phaseRepo: PipelinePhaseRepo
  ) {}

  async execute(input: StartPhaseInput): Promise<StartPhaseOutput> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);
    const phase = await this.phaseRepo.save(
      PipelinePhaseEntity.create({ projectId: project.id, stage: input.stage }).start()
    );
    return { phase };
  }
}
