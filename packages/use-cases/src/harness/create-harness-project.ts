import type { HarnessProjectRepo } from '@wolfkrow/domain';
import { HarnessProject } from '@wolfkrow/domain';

export interface CreateHarnessProjectInput {
  userId: string;
  name: string;
  specPath: string;
  description?: string;
  maxRoundsPerFeature?: number;
}

export interface CreateHarnessProjectOutput {
  project: HarnessProject;
}

export class CreateHarnessProjectUseCase {
  constructor(private readonly repo: HarnessProjectRepo) {}

  async execute(input: CreateHarnessProjectInput): Promise<CreateHarnessProjectOutput> {
    const project = HarnessProject.create({
      userId: input.userId,
      name: input.name,
      specPath: input.specPath,
      description: input.description,
      config: {
        maxRoundsPerFeature: input.maxRoundsPerFeature ?? 5,
        coderModel: 'claude-sonnet-4-6',
        plannerModel: 'claude-opus-4-8',
      },
    });
    const saved = await this.repo.save(project);
    return { project: saved };
  }
}
