import type { Agent, AgentRepo, AgentUpdateInput } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface UpdateAgentInput {
  id: string;
  userId: string;
  patch: AgentUpdateInput;
}
export interface UpdateAgentOutput {
  agent: Agent;
}

export class UpdateAgentUseCase implements UseCase<UpdateAgentInput, UpdateAgentOutput> {
  constructor(private readonly repo: AgentRepo) {}

  async execute(input: UpdateAgentInput): Promise<UpdateAgentOutput> {
    const existing = await this.repo.findById(input.id);
    if (!existing) throw new NotFoundError('Agent', input.id);
    const updated = await this.repo.save(existing.update(input.patch));
    return { agent: updated };
  }
}
