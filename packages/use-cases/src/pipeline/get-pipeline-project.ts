import type { PipelineProject, PipelineProjectRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface GetPipelineProjectInput { projectId: string; }
export interface GetPipelineProjectOutput { project: PipelineProject; }

export class GetPipelineProjectUseCase {
  constructor(private readonly repo: PipelineProjectRepo) {}
  async execute(input: GetPipelineProjectInput): Promise<GetPipelineProjectOutput> {
    const project = await this.repo.findById(input.projectId);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);
    return { project };
  }
}
