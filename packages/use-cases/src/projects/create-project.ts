import { Project, type ProjectCreateInput, type ProjectRepo } from '@wolfkrow/domain';

/**
 * Client-supplied input for creating a project. `userId` is NOT part of this
 * object — it is server-derived from the authenticated session and passed as a
 * separate parameter to `execute`, so a client cannot spoof another user's
 * identity by sending `userId` in the request body.
 *
 * Omit `userId` from the domain's `ProjectCreateInput` so the two are merged
 * cleanly without overwriting each other.
 */
export type CreateProjectInput = Omit<ProjectCreateInput, 'userId'>;

export interface CreateProjectOutput {
  project: Project;
}

export class CreateProjectUseCase {
  constructor(private readonly repo: ProjectRepo) {}
  async execute(userId: string, input: CreateProjectInput): Promise<CreateProjectOutput> {
    const project = await this.repo.save(Project.create({ ...input, userId }));
    return { project };
  }
}
