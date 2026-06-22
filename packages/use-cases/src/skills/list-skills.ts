import type { Skill } from '@wolfkrow/domain';
import type { SkillRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface ListSkillsInput { userId: string; builtinOnly?: boolean; }
export interface ListSkillsOutput { skills: Skill[]; }

export class ListSkillsUseCase implements UseCase<ListSkillsInput, ListSkillsOutput> {
  constructor(private readonly repo: SkillRepo) {}

  async execute(input: ListSkillsInput): Promise<ListSkillsOutput> {
    const skills = input.builtinOnly
      ? await this.repo.findBuiltIn()
      : await this.repo.findByUserId(input.userId);
    return { skills };
  }
}
