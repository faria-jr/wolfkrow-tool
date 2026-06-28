import { Skill, type SkillCreateInput } from '@wolfkrow/domain';
import type { SkillRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface CreateSkillOutput {
  skill: Skill;
}

export class CreateSkillUseCase implements UseCase<SkillCreateInput, CreateSkillOutput> {
  constructor(private readonly repo: SkillRepo) {}

  async execute(input: SkillCreateInput): Promise<CreateSkillOutput> {
    const skill = await this.repo.save(Skill.create(input));
    return { skill };
  }
}
