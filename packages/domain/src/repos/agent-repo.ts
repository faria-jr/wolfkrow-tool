import type { Agent } from '../entities/agent';

import type { Repository } from './index';

export interface AgentRepo extends Repository<Agent, string> {
  findByUserId(userId: string): Promise<Agent[]>;
  findActiveByUserId(userId: string): Promise<Agent[]>;
}
