import type { HarnessProject, HarnessProjectRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface GetHarnessProjectInput {
  projectId: string;
}
export interface GetHarnessProjectOutput {
  project: HarnessProject;
}

export class GetHarnessProjectUseCase {
  constructor(private readonly repo: HarnessProjectRepo) {}

  async execute(input: GetHarnessProjectInput): Promise<GetHarnessProjectOutput> {
    const project = await this.repo.findById(input.projectId);
    if (!project) throw new NotFoundError('HarnessProject', input.projectId);
    return { project };
  }
}
