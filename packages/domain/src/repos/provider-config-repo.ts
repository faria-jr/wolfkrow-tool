import type { ProviderConfig } from '../value-objects/provider-config';

export interface ProviderConfigRepo {
  findAll(userId: string): Promise<ProviderConfig[]>;
  upsert(userId: string, config: ProviderConfig): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
}
