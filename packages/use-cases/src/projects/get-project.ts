import { NotFoundError, type Project, type ProjectRepo } from '@wolfkrow/domain';

export interface GetProjectInput {
  projectId: string;
}
export interface GetProjectOutput {
  project: Project;
}

export class GetProjectUseCase {
  constructor(private readonly repo: ProjectRepo) {}
  async execute(input: GetProjectInput): Promise<GetProjectOutput> {
    const project = await this.repo.findById(input.projectId);
    if (!project) throw new NotFoundError('Project', input.projectId);
    return { project };
  }
}
