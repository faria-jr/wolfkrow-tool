import type { HarnessProject } from '../entities/harness-project';
import type { HarnessRound } from '../entities/harness-round';
import type { HarnessSprint } from '../entities/harness-sprint';

export interface HarnessProjectRepo {
  findById(id: string): Promise<HarnessProject | null>;
  findByUserId(userId: string): Promise<HarnessProject[]>;
  save(project: HarnessProject): Promise<HarnessProject>;
  delete(id: string): Promise<void>;
}

export interface HarnessSprintRepo {
  findById(id: string): Promise<HarnessSprint | null>;
  findByProjectId(projectId: string): Promise<HarnessSprint[]>;
  save(sprint: HarnessSprint): Promise<HarnessSprint>;
}

export interface HarnessRoundRepo {
  findById(id: string): Promise<HarnessRound | null>;
  findBySprintId(sprintId: string): Promise<HarnessRound[]>;
  findBySprintAndFeature(sprintId: string, featureIndex: number): Promise<HarnessRound[]>;
  save(round: HarnessRound): Promise<HarnessRound>;
}
