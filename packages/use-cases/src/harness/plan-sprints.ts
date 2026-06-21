import type { HarnessProjectRepo, HarnessSprintRepo, SprintFeature } from '@wolfkrow/domain';
import { HarnessSprint, NotFoundError } from '@wolfkrow/domain';

export interface PlannerSprintData {
  name: string;
  description: string;
  features: SprintFeature[];
}

export interface HarnessPlanner {
  plan(specContent: string, config: { plannerModel: string }): Promise<PlannerSprintData[]>;
}

export interface PlanSprintsInput {
  projectId: string;
  specContent: string;
}

export interface PlanSprintsOutput {
  sprints: HarnessSprint[];
}

export class PlanSprintsUseCase {
  constructor(
    private readonly projectRepo: HarnessProjectRepo,
    private readonly sprintRepo: HarnessSprintRepo,
    private readonly planner: HarnessPlanner,
  ) {}

  async execute(input: PlanSprintsInput): Promise<PlanSprintsOutput> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundError('HarnessProject', input.projectId);

    const sprintData = await this.planner.plan(input.specContent, { plannerModel: project.config.plannerModel });

    const sprints = await Promise.all(
      sprintData.map((data, i) =>
        this.sprintRepo.save(HarnessSprint.create({
          projectId: project.id,
          number: i + 1,
          name: data.name,
          description: data.description,
          features: data.features,
        })),
      ),
    );

    await this.projectRepo.save(project.withStatus('ready'));
    return { sprints };
  }
}
