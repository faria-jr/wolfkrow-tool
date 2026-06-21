import type { AgentRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface DeleteAgentInput { id: string; userId: string; }
export interface DeleteAgentOutput { deleted: boolean; }

export class DeleteAgentUseCase implements UseCase<DeleteAgentInput, DeleteAgentOutput> {
  constructor(private readonly repo: AgentRepo) {}

  async execute(input: DeleteAgentInput): Promise<DeleteAgentOutput> {
    const existing = await this.repo.findById(input.id);
    if (!existing) throw new NotFoundError('Agent', input.id);
    await this.repo.delete(input.id);
    return { deleted: true };
  }
}
