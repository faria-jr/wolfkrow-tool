import type { Project, ProjectRepo } from '@wolfkrow/domain';

export interface ListProjectsOutput {
  projects: Project[];
}

export class ListProjectsUseCase {
  constructor(private readonly repo: ProjectRepo) {}
  async execute(): Promise<ListProjectsOutput> {
    return { projects: await this.repo.findAll() };
  }
}
