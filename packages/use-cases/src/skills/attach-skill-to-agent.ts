import { NotFoundError, type Agent } from '@wolfkrow/domain';
import type { SkillRepo, AgentRepo } from '@wolfkrow/domain';
import type { UseCase } from '../use-case';

export interface AttachSkillInput { skillId: string; agentId: string; }
export interface AttachSkillOutput { agent: Agent; }

export class AttachSkillToAgentUseCase implements UseCase<AttachSkillInput, AttachSkillOutput> {
  constructor(private readonly skillRepo: SkillRepo, private readonly agentRepo: AgentRepo) {}

  async execute(input: AttachSkillInput): Promise<AttachSkillOutput> {
    const skill = await this.skillRepo.findById(input.skillId);
    if (!skill) throw new NotFoundError('Skill', input.skillId);
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) throw new NotFoundError('Agent', input.agentId);
    if (agent.skills.includes(input.skillId)) return { agent };
    const updated = await this.agentRepo.save(agent.update({ skills: [...agent.skills, input.skillId] }));
    return { agent: updated };
  }
}
