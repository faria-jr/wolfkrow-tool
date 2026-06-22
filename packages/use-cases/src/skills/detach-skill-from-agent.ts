import { NotFoundError, type Agent } from '@wolfkrow/domain';
import type { AgentRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface DetachSkillInput { skillId: string; agentId: string; }
export interface DetachSkillOutput { agent: Agent; }

export class DetachSkillFromAgentUseCase implements UseCase<DetachSkillInput, DetachSkillOutput> {
  constructor(private readonly agentRepo: AgentRepo) {}

  async execute(input: DetachSkillInput): Promise<DetachSkillOutput> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) throw new NotFoundError('Agent', input.agentId);
    const updated = await this.agentRepo.save(agent.update({ skills: agent.skills.filter((s) => s !== input.skillId) }));
    return { agent: updated };
  }
}
