import { NotFoundError, type Project, type ProjectRepo, type ProjectUpdateInput } from '@wolfkrow/domain';

export type UpdateProjectInput = ProjectUpdateInput;

export interface UpdateProjectOutput {
  project: Project;
}

export class UpdateProjectUseCase {
  constructor(private readonly repo: ProjectRepo) {}
  async execute(
    projectId: string,
    input: UpdateProjectInput
  ): Promise<UpdateProjectOutput> {
    const existing = await this.repo.findById(projectId);
    if (!existing) throw new NotFoundError('Project', projectId);
    const updated = await this.repo.save(existing.with(input));
    return { project: updated };
  }
}
