import type { EnrichSession } from '../entities/enrich-session';

export interface EnrichSessionRepo {
  findById(id: string): Promise<EnrichSession | null>;
  findByUserId(userId: string): Promise<EnrichSession[]>;
  save(session: EnrichSession): Promise<EnrichSession>;
  delete(id: string): Promise<void>;
}
