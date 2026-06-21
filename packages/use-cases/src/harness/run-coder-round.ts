import type { HarnessRound, HarnessRoundRepo, HarnessSprintRepo } from '@wolfkrow/domain';
import { HarnessRound as HarnessRoundEntity, NotFoundError } from '@wolfkrow/domain';

export interface CoderAgent {
  implement(input: {
    sprintName: string;
    featureName: string;
    featureDescription: string;
    acceptanceCriteria: string[];
    previousFeedback?: string;
    coderModel: string;
  }): Promise<{ output: string; tokens: number }>;
}

export interface RunCoderRoundInput {
  sprintId: string;
  featureIndex: number;
  roundNumber: number;
  previousFeedback?: string;
  coderModel?: string;
}

export interface RunCoderRoundOutput {
  round: HarnessRound;
}

export class RunCoderRoundUseCase {
  constructor(
    private readonly sprintRepo: HarnessSprintRepo,
    private readonly roundRepo: HarnessRoundRepo,
    private readonly coder: CoderAgent,
  ) {}

  async execute(input: RunCoderRoundInput): Promise<RunCoderRoundOutput> {
    const sprint = await this.sprintRepo.findById(input.sprintId);
    if (!sprint) throw new NotFoundError('HarnessSprint', input.sprintId);

    const feature = sprint.features[input.featureIndex];
    if (!feature) throw new NotFoundError('SprintFeature', `${input.sprintId}:${input.featureIndex}`);

    let round = await this.roundRepo.save(
      HarnessRoundEntity.create({ sprintId: sprint.id, featureIndex: input.featureIndex, roundNumber: input.roundNumber }),
    );

    const result = await this.coder.implement({
      sprintName: sprint.name,
      featureName: feature.name,
      featureDescription: feature.description,
      acceptanceCriteria: feature.acceptanceCriteria,
      coderModel: input.coderModel ?? 'claude-sonnet-4-6',
      ...(input.previousFeedback !== undefined ? { previousFeedback: input.previousFeedback } : {}),
    });

    round = await this.roundRepo.save(round.withCoderOutput(result.output, result.tokens));
    return { round };
  }
}
