import { NotFoundError, type Skill, type SkillUpdateInput } from '@wolfkrow/domain';
import type { SkillRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface UpdateSkillInput extends SkillUpdateInput { id: string; }
export interface UpdateSkillOutput { skill: Skill; }

export class UpdateSkillUseCase implements UseCase<UpdateSkillInput, UpdateSkillOutput> {
  constructor(private readonly repo: SkillRepo) {}

  async execute(input: UpdateSkillInput): Promise<UpdateSkillOutput> {
    const existing = await this.repo.findById(input.id);
    if (!existing) throw new NotFoundError('Skill', input.id);
    const { id: _id, ...patch } = input;
    const skill = await this.repo.save(existing.update(patch));
    return { skill };
  }
}
