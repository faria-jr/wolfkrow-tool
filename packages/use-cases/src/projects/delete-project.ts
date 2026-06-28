import { NotFoundError, type ProjectRepo } from '@wolfkrow/domain';

export interface DeleteProjectInput {
  projectId: string;
}

export class DeleteProjectUseCase {
  constructor(private readonly repo: ProjectRepo) {}
  async execute(input: DeleteProjectInput): Promise<void> {
    const project = await this.repo.findById(input.projectId);
    if (!project) throw new NotFoundError('Project', input.projectId);
    await this.repo.delete(input.projectId);
  }
}
