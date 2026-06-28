import type { PipelineProject, PipelineProjectRepo } from '@wolfkrow/domain';

export interface ListPipelineProjectsInput {
  userId: string;
}
export interface ListPipelineProjectsOutput {
  projects: PipelineProject[];
}

export class ListPipelineProjectsUseCase {
  constructor(private readonly repo: PipelineProjectRepo) {}
  async execute(input: ListPipelineProjectsInput): Promise<ListPipelineProjectsOutput> {
    return { projects: await this.repo.findByUserId(input.userId) };
  }
}
