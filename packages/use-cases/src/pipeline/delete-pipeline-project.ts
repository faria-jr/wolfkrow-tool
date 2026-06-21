import type { PipelineProjectRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface DeletePipelineProjectInput { projectId: string; userId: string; }

export class DeletePipelineProjectUseCase {
  constructor(private readonly repo: PipelineProjectRepo) {}
  async execute(input: DeletePipelineProjectInput): Promise<void> {
    const project = await this.repo.findById(input.projectId);
    if (!project || project.userId !== input.userId) throw new NotFoundError('PipelineProject', input.projectId);
    await this.repo.delete(input.projectId);
  }
}
