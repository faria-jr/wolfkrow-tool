import type {
  PipelineMessageRepo,
  PipelinePhaseRepo,
  PipelineProjectRepo,
  PipelineStage,
} from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

const STAGE_ORDER: Record<PipelineStage, number> = {
  discovery: 0,
  spec_build: 1,
  spec_validate: 2,
  approval: 3,
  design: 4,
  design_lock: 5,
  implementation: 6,
  completed: 7,
};

export interface GenerateReportInput {
  projectId: string;
}

export interface GenerateReportOutput {
  report: string;
}

/**
 * consolidates a pipeline project's phases + assistant outputs
 * into a single Markdown report. Pulls assistant messages from the DB (the same
 * content persisted as phase artifacts), ordered by stage.
 */
export class GeneratePipelineReportUseCase implements UseCase<
  GenerateReportInput,
  GenerateReportOutput
> {
  constructor(
    private readonly projectRepo: PipelineProjectRepo,
    private readonly phaseRepo: PipelinePhaseRepo,
    private readonly messageRepo?: PipelineMessageRepo
  ) {}

  async execute(input: GenerateReportInput): Promise<GenerateReportOutput> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);

    const phases = (await this.phaseRepo.findByProjectId(input.projectId)).sort(
      (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
    );
    const messages = this.messageRepo
      ? await this.messageRepo.findByProjectId(input.projectId)
      : [];

    const lines: string[] = [
      `# ${project.name}`,
      '',
      `- **Status:** ${project.status}`,
      `- **Current stage:** ${project.currentStage}`,
      ...(project.description ? ['', project.description] : []),
      '',
      '---',
      '',
    ];

    for (const phase of phases) {
      const assistant = messages
        .filter((m) => m.phaseId === phase.id && m.role === 'assistant')
        .map((m) => m.content)
        .join('\n\n');
      lines.push(`## ${phase.stage} — ${phase.status}`, '');
      if (phase.artifactPath) lines.push(`_Artifact: \`${phase.artifactPath}\`_`, '');
      lines.push(assistant || '_(no output recorded)_', '');
    }

    if (phases.length === 0) lines.push('_(no phases yet)_', '');

    return { report: lines.join('\n').trim() };
  }
}
