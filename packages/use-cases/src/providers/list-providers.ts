import { BUILT_IN_PROVIDERS, mergeProviders } from '@wolfkrow/domain';
import type { ProviderConfig, ProviderConfigRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface ListProvidersInput {
  userId: string;
}
export interface ListProvidersOutput {
  providers: ProviderConfig[];
}

export class ListProvidersUseCase implements UseCase<ListProvidersInput, ListProvidersOutput> {
  constructor(private readonly repo: ProviderConfigRepo) {}

  async execute(input: ListProvidersInput): Promise<ListProvidersOutput> {
    const custom = await this.repo.findAll(input.userId);
    const providers = mergeProviders(BUILT_IN_PROVIDERS, custom);
    return { providers };
  }
}
