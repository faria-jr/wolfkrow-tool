/**
 * Worker composition root (FIX-007).
 *
 * Worker routes must NOT import `@wolfkrow/infra` directly (Clean Arch §1.1).
 * This module is the only worker file that touches infra adapters; routes
 * resolve repos + adapters via `getRepos()` / `getAdapters()` instead of
 * constructing them inline.
 */

import type { EmbeddingPort, SecretsAdapter } from '@wolfkrow/domain';
import { aiProviderFactory, type AIProviderFactory, VoyageEmbedder } from '@wolfkrow/infra';
import { createRepoRegistry, type RepoRegistry } from '@wolfkrow/infra/repos';
import { KeytarSecretsAdapter } from '@wolfkrow/infra/secrets/keytar-adapter';

export type { RepoRegistry };

/** Singleton repo registry for the worker process. */
export function getRepos(): RepoRegistry {
  return createRepoRegistry();
}

export interface AdapterBundle {
  embedder: EmbeddingPort;
  secrets: SecretsAdapter;
  aiFactory: AIProviderFactory;
}

let _adapters: AdapterBundle | null = null;

/**
 * Singleton adapter bundle. The embedder is built from `VOYAGE_API_KEY` (env)
 * and the secrets adapter is keyless, so both are safe to construct eagerly.
 * `aiFactory` re-exposes the infra singleton so routes don't import infra.
 */
export function getAdapters(): AdapterBundle {
  if (_adapters) return _adapters;
  _adapters = {
    embedder: new VoyageEmbedder(process.env['VOYAGE_API_KEY'] ?? ''),
    secrets: new KeytarSecretsAdapter(),
    aiFactory: aiProviderFactory,
  };
  return _adapters;
}

/** Test helper: drop the cached adapter bundle. */
export function resetAdapters(): void {
  _adapters = null;
}
