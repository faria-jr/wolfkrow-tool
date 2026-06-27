import type { Skill } from '@wolfkrow/domain';
import type { SkillRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface ListSkillsInput { userId: string; builtinOnly?: boolean; }
export interface ListSkillsOutput { skills: Skill[]; }

export class ListSkillsUseCase implements UseCase<ListSkillsInput, ListSkillsOutput> {
  constructor(private readonly repo: SkillRepo) {}

  async execute(input: ListSkillsInput): Promise<ListSkillsOutput> {
    if (input.builtinOnly) {
      const skills = await this.repo.findBuiltIn();
      return { skills };
    }
    const custom = await this.repo.findByUserId(input.userId);
    if (input.userId === 'unknown') {
      return { skills: custom };
    }
    const builtIn = await this.repo.findBuiltIn();
    const map = new Map(builtIn.map((s) => [s.name, s]));
    for (const c of custom) {
      map.set(c.name, c);
    }
    const skills = [...map.values()];
    return { skills };
  }
}
