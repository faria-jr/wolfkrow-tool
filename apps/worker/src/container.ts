/**
 * Worker composition root (FIX-007).
 *
 * Worker routes must NOT import `@wolfkrow/infra` directly (Clean Arch §1.1).
 * This module is the only worker file that touches infra adapters; routes
 * resolve repos via `getRepos()` instead of `new DrizzleXxxRepo()`.
 */

import { createRepoRegistry, type RepoRegistry } from '@wolfkrow/infra/repos';

export type { RepoRegistry };

/** Singleton repo registry for the worker process. */
export function getRepos(): RepoRegistry {
  return createRepoRegistry();
}
