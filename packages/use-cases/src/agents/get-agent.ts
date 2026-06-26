import type { Agent, AgentRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface GetAgentInput { id: string; userId: string; }
export interface GetAgentOutput { agent: Agent; }

/**
 * EPIC 1.1 — fetch a single agent by id. Throws NotFoundError when missing.
 * The `userId` is part of the contract for parity with sibling use cases and
 * to give callers a single hook to add ownership checks later (the underlying
 * repo's `findById` is currently global, mirroring the existing behaviour of
 * UpdateAgentUseCase / DeleteAgentUseCase in this package).
 */
export class GetAgentUseCase implements UseCase<GetAgentInput, GetAgentOutput> {
  constructor(private readonly repo: AgentRepo) {}

  async execute(input: GetAgentInput): Promise<GetAgentOutput> {
    const agent = await this.repo.findById(input.id);
    if (!agent) throw new NotFoundError('Agent', input.id);
    return { agent };
  }
}