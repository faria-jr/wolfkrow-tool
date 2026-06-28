import type { Agent, AgentRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface DuplicateAgentInput {
  id: string;
  userId: string;
  newName: string;
}
export interface DuplicateAgentOutput {
  agent: Agent;
}

export class DuplicateAgentUseCase implements UseCase<DuplicateAgentInput, DuplicateAgentOutput> {
  constructor(private readonly repo: AgentRepo) {}

  async execute(input: DuplicateAgentInput): Promise<DuplicateAgentOutput> {
    const source = await this.repo.findById(input.id);
    if (!source) throw new NotFoundError('Agent', input.id);
    const copy = await this.repo.save(source.duplicate(input.newName));
    return { agent: copy };
  }
}
