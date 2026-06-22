import type { Skill } from '../entities/skill';

import type { Repository } from './index';

export interface SkillRepo extends Repository<Skill, string> {
  findByUserId(userId: string): Promise<Skill[]>;
  findBuiltIn(): Promise<Skill[]>;
  findByName(userId: string, name: string): Promise<Skill | null>;
}
