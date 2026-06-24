import type { ProviderConfigRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface DeleteProviderInput { userId: string; id: string; }

export class DeleteProviderUseCase implements UseCase<DeleteProviderInput, void> {
  constructor(private readonly repo: ProviderConfigRepo) {}

  async execute(input: DeleteProviderInput): Promise<void> {
    await this.repo.delete(input.userId, input.id);
  }
}
