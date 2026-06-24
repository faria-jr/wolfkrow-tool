import { BUILT_IN_PROVIDERS } from '@wolfkrow/domain';
import type { ProviderConfigRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface DeleteProviderInput { userId: string; id: string; }

const BUILT_IN_IDS: ReadonlySet<string> = new Set(BUILT_IN_PROVIDERS.map((p) => p.id));

export class DeleteProviderUseCase implements UseCase<DeleteProviderInput, void> {
  constructor(private readonly repo: ProviderConfigRepo) {}

  async execute(input: DeleteProviderInput): Promise<void> {
    if (BUILT_IN_IDS.has(input.id)) {
      throw new Error(`Cannot delete built-in provider: ${input.id}`);
    }
    await this.repo.delete(input.userId, input.id);
  }
}
