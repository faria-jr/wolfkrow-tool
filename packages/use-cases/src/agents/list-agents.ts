import type { Agent, AgentRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface ListAgentsInput { userId: string; activeOnly?: boolean; }
export interface ListAgentsOutput { agents: Agent[]; }

export class ListAgentsUseCase implements UseCase<ListAgentsInput, ListAgentsOutput> {
  constructor(private readonly repo: AgentRepo) {}

  async execute(input: ListAgentsInput): Promise<ListAgentsOutput> {
    const agents = input.activeOnly
      ? await this.repo.findActiveByUserId(input.userId)
      : await this.repo.findByUserId(input.userId);
    return { agents };
  }
}
