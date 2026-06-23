import type { AIStreamPort, PipelinePhase, PipelineProject, PipelinePhaseRepo, PipelineProjectRepo, PipelineStage } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

const NEXT_STAGE: Record<PipelineStage, PipelineStage | null> = {
  discovery: 'spec_build',
  spec_build: 'spec_validate',
  spec_validate: 'approval',
  approval: 'implementation',
  implementation: 'completed',
  completed: null,
};

const PHASE_PROMPTS: Partial<Record<PipelineStage, string>> = {
  discovery: 'You are a product discovery expert. Analyze the project and produce structured discovery notes: problem statement, target users, key requirements, constraints, and success metrics. Be concise and actionable.',
  spec_build: 'You are a technical architect. Based on the discovery notes, build a detailed technical specification: architecture decisions, API contracts, data models, implementation strategy, and risk assessment.',
  spec_validate: 'You are a senior QA engineer. Validate the technical specification for completeness, consistency, and feasibility. List any gaps, contradictions, or risks found. Provide a validation summary.',
  implementation: 'You are a senior software engineer. Implement the specified features following the technical specification. Write clean, tested, production-ready code.',
};

export interface RunPhaseInput {
  projectId: string;
  phaseId: string;
  userPrompt?: string;
  model?: string;
}

export interface RunPhaseOutput {
  phase: PipelinePhase;
  project: PipelineProject;
  output: string;
  tokens: number;
}

export class RunPhaseUseCase {
  constructor(
    private readonly projectRepo: PipelineProjectRepo,
    private readonly phaseRepo: PipelinePhaseRepo,
    private readonly aiProvider: AIStreamPort,
  ) {}

  async execute(input: RunPhaseInput): Promise<RunPhaseOutput> {
    const [project, phase] = await Promise.all([
      this.projectRepo.findById(input.projectId),
      this.phaseRepo.findById(input.phaseId),
    ]);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);
    if (!phase) throw new NotFoundError('PipelinePhase', input.phaseId);

    const systemPrompt = PHASE_PROMPTS[phase.stage] ?? 'You are a helpful assistant.';
    const userContent = input.userPrompt ?? this.buildDefaultContent(project);

    const result = await this.aiProvider.complete({
      model: input.model ?? 'claude-sonnet-4-6',
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 4096,
      temperature: 0.3,
    });

    const tokens = result.usage.inputTokens + result.usage.outputTokens;
    const completedPhase = await this.phaseRepo.save(phase.complete(undefined, tokens));

    const nextStage = NEXT_STAGE[phase.stage];
    const updatedProject = await this.projectRepo.save(
      nextStage
        ? project.withStage(nextStage)
        : project.withStatus('completed', new Date()),
    );

    return { phase: completedPhase, project: updatedProject, output: result.content, tokens };
  }

  private buildDefaultContent(project: PipelineProject): string {
    const parts = [`Project: ${project.name}`];
    if (project.description) parts.push(project.description);
    if (project.discoveryNotes) parts.push(`Discovery notes: ${project.discoveryNotes}`);
    return parts.join('\n');
  }
}
