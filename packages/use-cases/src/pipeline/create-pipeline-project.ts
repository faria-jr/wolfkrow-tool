import type { PipelineProject, PipelineProjectRepo } from '@wolfkrow/domain';
import { PipelineProject as PipelineProjectEntity } from '@wolfkrow/domain';

export interface CreatePipelineProjectInput { userId: string; name: string; description?: string; }
export interface CreatePipelineProjectOutput { project: PipelineProject; }

export class CreatePipelineProjectUseCase {
  constructor(private readonly repo: PipelineProjectRepo) {}
  async execute(input: CreatePipelineProjectInput): Promise<CreatePipelineProjectOutput> {
    const project = await this.repo.save(PipelineProjectEntity.create(input));
    return { project };
  }
}
