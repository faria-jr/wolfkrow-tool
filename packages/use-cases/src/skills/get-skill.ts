import type { Skill, SkillRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface GetSkillInput {
  id: string;
  userId: string;
}
export interface GetSkillOutput {
  skill: Skill;
}

export class GetSkillUseCase implements UseCase<GetSkillInput, GetSkillOutput> {
  constructor(private readonly repo: SkillRepo) {}

  async execute(input: GetSkillInput): Promise<GetSkillOutput> {
    const skill = await this.repo.findById(input.id);
    if (!skill) throw new NotFoundError('Skill', input.id);
    if (skill.userId !== input.userId) throw new NotFoundError('Skill', input.id);
    return { skill };
  }
}
