import { Agent } from '@wolfkrow/domain';
import type { AgentCreateInput, AgentRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export type CreateAgentInput = AgentCreateInput;
export interface CreateAgentOutput { agent: Agent; }

export class CreateAgentUseCase implements UseCase<CreateAgentInput, CreateAgentOutput> {
  constructor(private readonly repo: AgentRepo) {}

  async execute(input: CreateAgentInput): Promise<CreateAgentOutput> {
    const agent = await this.repo.save(Agent.create(input));
    return { agent };
  }
}
