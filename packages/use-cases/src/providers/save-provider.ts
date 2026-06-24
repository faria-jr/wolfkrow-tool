import { ProviderConfig } from '@wolfkrow/domain';
import type { ProviderConfigProps, ProviderConfigRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface SaveProviderInput {
  userId: string;
  config: ProviderConfigProps;
}

export class SaveProviderUseCase implements UseCase<SaveProviderInput, void> {
  constructor(private readonly repo: ProviderConfigRepo) {}

  async execute(input: SaveProviderInput): Promise<void> {
    const cfg = ProviderConfig.create(input.config);
    await this.repo.upsert(input.userId, cfg);
  }
}
