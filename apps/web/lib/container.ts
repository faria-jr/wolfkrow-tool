/**
 * Web composition root (FIX-007).
 *
 * Web API routes must NOT import `@wolfkrow/infra` directly (Clean Arch §1.1).
 * This module is the only web file that touches infra adapters; routes resolve
 * repos + adapters via `getRepos()` / `getAdapters()` instead of constructing
 * them inline. Mirrors the worker composition root (apps/worker/src/container.ts)
 * — both apps are separate composition roots sharing the same DB (FIX-001).
 */

import type { EmbeddingPort, PasswordHasher, SecretsAdapter, TotpVerifier } from '@wolfkrow/domain';
import {
  aiProviderFactory,
  type AIProviderFactory,
  BcryptHasher,
  OtplibTotp,
  VoyageEmbedder,
} from '@wolfkrow/infra';
import { createRepoRegistry, type RepoRegistry } from '@wolfkrow/infra/repos';
import { KeytarSecretsAdapter } from '@wolfkrow/infra/secrets/keytar-adapter';

export type { RepoRegistry };

/** Singleton repo registry for the web process. */
export function getRepos(): RepoRegistry {
  return createRepoRegistry();
}

export interface AdapterBundle {
  embedder: EmbeddingPort;
  secrets: SecretsAdapter;
  aiFactory: AIProviderFactory;
  hasher: PasswordHasher;
  totp: TotpVerifier;
}

let _adapters: AdapterBundle | null = null;

/**
 * Singleton adapter bundle. All adapters are safe to construct eagerly
 * (env key / keyless ctors). `hasher` + `totp` are web-specific (auth routes);
 * the worker container doesn't need them.
 */
export function getAdapters(): AdapterBundle {
  if (_adapters) return _adapters;
  _adapters = {
    embedder: new VoyageEmbedder(process.env['VOYAGE_API_KEY'] ?? ''),
    secrets: new KeytarSecretsAdapter(),
    aiFactory: aiProviderFactory,
    hasher: new BcryptHasher(),
    totp: new OtplibTotp(),
  };
  return _adapters;
}

/** Test helper: drop the cached adapter bundle. */
export function resetAdapters(): void {
  _adapters = null;
}
