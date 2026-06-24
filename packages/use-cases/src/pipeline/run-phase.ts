import type { AIStreamPort, ArtifactWriter, PipelinePhase, PipelinePhaseRepo, PipelineProject, PipelineProjectRepo, PipelineStage, PipelineMessageRepo } from '@wolfkrow/domain';
import { NotFoundError, PipelineMessage as PipelineMessageEntity } from '@wolfkrow/domain';

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

export interface RunPhaseOptions {
 messageRepo?: PipelineMessageRepo;
 artifactWriter?: ArtifactWriter;
}

export class RunPhaseUseCase {
 private readonly messageRepo?: PipelineMessageRepo;
 private readonly artifactWriter?: ArtifactWriter;

 constructor(
 private readonly projectRepo: PipelineProjectRepo,
 private readonly phaseRepo: PipelinePhaseRepo,
 private readonly aiProvider: AIStreamPort,
 options: RunPhaseOptions = {},
 ) {
 if (options.messageRepo) this.messageRepo = options.messageRepo;
 if (options.artifactWriter) this.artifactWriter = options.artifactWriter;
 }

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
 const artifactPath = await this.persistExchange(project, phase, userContent, result);

 const completedPhase = await this.phaseRepo.save(phase.complete(artifactPath, tokens));

 const nextStage = NEXT_STAGE[phase.stage];
 const updatedProject = await this.projectRepo.save(
 nextStage
 ? project.withStage(nextStage)
 : project.withStatus('completed', new Date()),
 );

 return { phase: completedPhase, project: updatedProject, output: result.content, tokens };
 }

 /**
 * persist the AI exchange atomically (user always, assistant only when
 * non-empty) and write the artifact. Returns the artifact path, if any.
 */
 private async persistExchange(
 project: PipelineProject,
 phase: PipelinePhase,
 userContent: string,
 result: { content: string },
 ): Promise<string | undefined> {
 const hasOutput = result.content.trim().length > 0;
 if (this.messageRepo) {
 const msgs: PipelineMessageEntity[] = [
 PipelineMessageEntity.create({ projectId: project.id, phaseId: phase.id, role: 'user', content: userContent }),
 ];
 if (hasOutput) {
 msgs.push(PipelineMessageEntity.create({ projectId: project.id, phaseId: phase.id, role: 'assistant', content: result.content }));
 }
 await this.messageRepo.saveMany(msgs);
 }
 if (this.artifactWriter && hasOutput) {
 return this.artifactWriter.write(`${project.id}/${phase.id}-${phase.stage}`, result.content);
 }
 return undefined;
 }

 private buildDefaultContent(project: PipelineProject): string {
 const parts = [`Project: ${project.name}`];
 if (project.description) parts.push(project.description);
 if (project.discoveryNotes) parts.push(`Discovery notes: ${project.discoveryNotes}`);
 return parts.join('\n');
 }
}
