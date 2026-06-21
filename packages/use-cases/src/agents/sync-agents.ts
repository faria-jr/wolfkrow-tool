import type { Agent, AgentRepo } from '@wolfkrow/domain';
import type { Runtime } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface SyncAgentsInput {
  userId: string;
  targetRuntime: Runtime;
  targetModel: string | undefined;
}

export interface SyncAgentsOutput {
  synced: number;
  agents: Agent[];
}

/** Alinha todos os agents do usuário ao runtime/model alvo (sync em massa). */
export class SyncAgentsToOrchestratorUseCase implements UseCase<SyncAgentsInput, SyncAgentsOutput> {
  constructor(private readonly repo: AgentRepo) {}

  async execute(input: SyncAgentsInput): Promise<SyncAgentsOutput> {
    const agents = await this.repo.findByUserId(input.userId);
    const toUpdate = agents.filter(
      (a) =>
        a.runtime !== input.targetRuntime ||
        (input.targetModel !== undefined && a.model !== input.targetModel),
    );

    const updated = await Promise.all(
      toUpdate.map((a) =>
        this.repo.save(
          a.update({
            runtime: input.targetRuntime,
            ...(input.targetModel !== undefined ? { model: input.targetModel } : {}),
          }),
        ),
      ),
    );

    return { synced: updated.length, agents: updated };
  }
}
