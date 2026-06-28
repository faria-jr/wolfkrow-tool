import { Secret } from '@wolfkrow/domain';
import type { SecretCategory, SecretRepo, SecretsAdapter } from '@wolfkrow/domain';

export type { SecretsAdapter } from '@wolfkrow/domain';

// --- List Secrets ---

export interface ListSecretsInput {
  userId: string;
}
export interface ListSecretsOutput {
  secrets: Secret[];
}

export class ListSecretsUseCase {
  constructor(private readonly repo: SecretRepo) {}

  async execute(input: ListSecretsInput): Promise<ListSecretsOutput> {
    const secrets = await this.repo.findAll(input.userId);
    return { secrets };
  }
}

// --- Store Secret ---

export interface StoreSecretInput {
  userId: string;
  key: string;
  value: string;
  displayName: string;
  category: SecretCategory;
  description?: string;
}

export class StoreSecretUseCase {
  constructor(
    private readonly repo: SecretRepo,
    private readonly adapter: SecretsAdapter
  ) {}

  async execute(input: StoreSecretInput): Promise<{ secret: Secret }> {
    await this.adapter.set(input.key, input.value);

    const existing = await this.repo.findByKey(input.key);
    const secret = existing
      ? existing.withRotated()
      : Secret.create({
          userId: input.userId,
          key: input.key,
          displayName: input.displayName,
          category: input.category,
          ...(input.description !== undefined ? { description: input.description } : {}),
        });

    const saved = await this.repo.save(secret);
    return { secret: saved };
  }
}

// --- Get Secret Value ---

export interface GetSecretValueInput {
  key: string;
}
export interface GetSecretValueOutput {
  value: string | null;
}

export class GetSecretValueUseCase {
  constructor(
    private readonly repo: SecretRepo,
    private readonly adapter: SecretsAdapter
  ) {}

  async execute(input: GetSecretValueInput): Promise<GetSecretValueOutput> {
    const value = await this.adapter.get(input.key);

    // update lastAccessed
    const secret = await this.repo.findByKey(input.key);
    if (secret) await this.repo.save(secret.withAccessed());

    return { value };
  }
}

// --- Delete Secret ---

export interface DeleteSecretInput {
  key: string;
}

export class DeleteSecretUseCase {
  constructor(
    private readonly repo: SecretRepo,
    private readonly adapter: SecretsAdapter
  ) {}

  async execute(input: DeleteSecretInput): Promise<void> {
    await this.adapter.delete(input.key);
    await this.repo.delete(input.key);
  }
}
