import type {
  AIStreamPort,
  ArtifactWriter,
  PipelineMessage,
  PipelineMessageRepo,
  PipelinePhase,
  PipelinePhaseRepo,
  PipelineProject,
  PipelineProjectRepo,
} from '@wolfkrow/domain';
import { NotFoundError, PipelineMessage as PipelineMessageEntity } from '@wolfkrow/domain';

/**
 * DEBT #12 — Multi-turn conversation within a pipeline phase (awaiting-input).
 *
 * Unlike RunPhaseUseCase (which runs once, completes the phase, and advances the
 * stage), this appends a user turn to the phase's existing message history,
 * runs the AI with the FULL conversation, persists the exchange, and returns —
 * the phase stays open so the user can send further turns or then advance via
 * the normal run/approve flow.
 */

export interface ContinueConversationInput {
  projectId: string;
  phaseId: string;
  userPrompt: string;
  model?: string;
}

export interface ContinueConversationOutput {
  phase: PipelinePhase;
  output: string;
  tokens: number;
  messages: PipelineMessage[];
}

export interface ContinueConversationOptions {
  messageRepo?: PipelineMessageRepo;
  artifactWriter?: ArtifactWriter;
}

export class ContinuePipelineConversationUseCase {
  private readonly messageRepo?: PipelineMessageRepo;
  private readonly artifactWriter?: ArtifactWriter;

  constructor(
    private readonly projectRepo: PipelineProjectRepo,
    private readonly phaseRepo: PipelinePhaseRepo,
    private readonly aiProvider: AIStreamPort,
    options: ContinueConversationOptions = {}
  ) {
    if (options.messageRepo) this.messageRepo = options.messageRepo;
    if (options.artifactWriter) this.artifactWriter = options.artifactWriter;
  }

  async execute(input: ContinueConversationInput): Promise<ContinueConversationOutput> {
    const [project, phase] = await Promise.all([
      this.projectRepo.findById(input.projectId),
      this.phaseRepo.findById(input.phaseId),
    ]);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);
    if (!phase) throw new NotFoundError('PipelinePhase', input.phaseId);

    const history = this.messageRepo ? await this.messageRepo.findByPhaseId(phase.id) : [];
    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: input.userPrompt },
    ];

    const system =
      'You are a helpful assistant continuing a pipeline conversation. Use the prior turns for context.';
    const result = await this.aiProvider.complete({
      model: input.model ?? 'claude-sonnet-4-6',
      system,
      messages,
      maxTokens: 4096,
      temperature: 0.3,
    });

    const tokens = result.usage.inputTokens + result.usage.outputTokens;
    const savedMessages = await this.persist(project, phase, input.userPrompt, result.content);

    return { phase, output: result.content, tokens, messages: savedMessages };
  }

  private async persist(
    project: PipelineProject,
    phase: PipelinePhase,
    userContent: string,
    assistantContent: string
  ): Promise<PipelineMessage[]> {
    const msgs: PipelineMessageEntity[] = [
      PipelineMessageEntity.create({
        projectId: project.id,
        phaseId: phase.id,
        role: 'user',
        content: userContent,
      }),
      PipelineMessageEntity.create({
        projectId: project.id,
        phaseId: phase.id,
        role: 'assistant',
        content: assistantContent,
      }),
    ];
    if (this.messageRepo) await this.messageRepo.saveMany(msgs);
    if (this.artifactWriter && assistantContent.trim()) {
      await this.artifactWriter.write(
        `${project.id}/${phase.id}-${phase.stage}-chat`,
        assistantContent
      );
    }
    return msgs;
  }
}
