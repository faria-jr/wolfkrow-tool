import type { PipelineProject, PipelineProjectRepo } from '@wolfkrow/domain';
import { PipelineProject as PipelineProjectEntity } from '@wolfkrow/domain';

/**
 * Client-supplied input for creating a pipeline project. `userId` is NOT part of
 * this object — it is server-derived from the authenticated session and passed
 * as a separate parameter to `execute`, so a client cannot spoof another user's
 * identity by sending `userId` in the request body.
 */
export interface CreatePipelineProjectInput { name: string; description?: string; }
export interface CreatePipelineProjectOutput { project: PipelineProject; }

export class CreatePipelineProjectUseCase {
  constructor(private readonly repo: PipelineProjectRepo) {}
  async execute(userId: string, input: CreatePipelineProjectInput): Promise<CreatePipelineProjectOutput> {
    const project = await this.repo.save(PipelineProjectEntity.create({ userId, ...input }));
    return { project };
  }
}
