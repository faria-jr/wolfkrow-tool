import { NotFoundError } from '@wolfkrow/domain';
import type { SkillRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface DeleteSkillInput { id: string; }

export class DeleteSkillUseCase implements UseCase<DeleteSkillInput, void> {
  constructor(private readonly repo: SkillRepo) {}

  async execute(input: DeleteSkillInput): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing) throw new NotFoundError('Skill', input.id);
    await this.repo.delete(input.id);
  }
}
