import type { HarnessProjectRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface DeleteHarnessProjectInput { projectId: string; userId: string; }

export class DeleteHarnessProjectUseCase {
  constructor(private readonly repo: HarnessProjectRepo) {}

  async execute(input: DeleteHarnessProjectInput): Promise<void> {
    const project = await this.repo.findById(input.projectId);
    if (!project || project.userId !== input.userId) {
      throw new NotFoundError('HarnessProject', input.projectId);
    }
    await this.repo.delete(input.projectId);
  }
}
