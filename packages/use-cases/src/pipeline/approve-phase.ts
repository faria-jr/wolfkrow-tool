import type {
  PipelinePhase,
  PipelinePhaseRepo,
  PipelineProject,
  PipelineProjectProps,
  PipelineProjectRepo,
} from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

/**
 * M5.5 — Approve (or reject) a pipeline phase that's awaiting user input.
 *
 * Supports three concerns:
 *   1. Simple approve/reject with notes (back-compat with the previous API).
 *   2. Approve-with-edits: the user submits a `specEdits` string that
 *      replaces the spec the next stages will see.
 *   3. Stage progression: when the approved stage is the `approval`
 *      checkpoint, advances the project to `implementation`; otherwise
 *      the project just resumes from the current stage.
 */
export interface ApprovePipelinePhaseInput {
  projectId: string;
  phaseId: string;
  approved: boolean;
  notes?: string;
  specEdits?: string;
}

export interface ApprovePipelinePhaseOutput {
  project: PipelineProject;
  phase: PipelinePhase;
}

export class ApprovePipelinePhaseUseCase {
  constructor(
    private readonly projectRepo: PipelineProjectRepo,
    private readonly phaseRepo: PipelinePhaseRepo,
  ) {}

  async execute(input: ApprovePipelinePhaseInput): Promise<ApprovePipelinePhaseOutput> {
    const [project, phase] = await Promise.all([
      this.projectRepo.findById(input.projectId),
      this.phaseRepo.findById(input.phaseId),
    ]);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);
    if (!phase) throw new NotFoundError('PipelinePhase', input.phaseId);

    const updatedPhase = await this.phaseRepo.save(input.approved ? phase.complete() : phase.fail());

    let updatedProject: PipelineProject;
    if (!input.approved) {
      updatedProject = await this.projectRepo.save(project.withStatus('paused'));
      return { project: updatedProject, phase: updatedPhase };
    }

    const approvalExtras: Partial<
      Pick<PipelineProjectProps, 'approvalNotes' | 'specEdits' | 'status'>
    > = {
      status: 'running',
    };
    if (input.notes !== undefined) approvalExtras.approvalNotes = input.notes;
    if (input.specEdits !== undefined) approvalExtras.specEdits = input.specEdits;

    const nextStage =
      phase.stage === 'approval' ? 'implementation' : project.currentStage;
    updatedProject = await this.projectRepo.save(project.withStage(nextStage, approvalExtras));
    return { project: updatedProject, phase: updatedPhase };
  }
}
