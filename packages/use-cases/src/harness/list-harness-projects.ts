import type { HarnessProject, HarnessProjectRepo } from '@wolfkrow/domain';

export interface ListHarnessProjectsInput { userId: string; }
export interface ListHarnessProjectsOutput { projects: HarnessProject[]; }

export class ListHarnessProjectsUseCase {
  constructor(private readonly repo: HarnessProjectRepo) {}

  async execute(input: ListHarnessProjectsInput): Promise<ListHarnessProjectsOutput> {
    const projects = await this.repo.findByUserId(input.userId);
    return { projects };
  }
}
