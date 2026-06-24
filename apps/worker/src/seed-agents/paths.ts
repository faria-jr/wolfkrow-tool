import { readlinkSync, realpathSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolve the seed-agent YAML directory.
 *
 * Source of truth is the repo-root `.wolfkrow/agents/` directory, exposed to
 * the worker via the symlink `apps/worker/src/seed-agents/yaml`. We resolve
 * the symlink to its real path so callers always read the canonical files.
 *
 * Resolution order:
 *  1. `WOLFKROW_SEED_AGENTS_DIR` env override (tests, custom installs).
 *  2. The `yaml` symlink next to this module → realpath `.wolfkrow/agents`.
 *  3. `<repoRoot>/.wolfkrow/agents` fallback.
 */
export function resolveSeedAgentsDir(): string {
  const override = process.env['WOLFKROW_SEED_AGENTS_DIR'];
  if (override) return override;

  const symlink = new URL('./yaml', import.meta.url).pathname;
  if (existsSync(symlink)) {
    try {
      // if it's a symlink, resolve it; realpathSync also works on regular dirs.
      const stat = readlinkSync(symlink);
      return resolve(dirname(symlink), stat);
    } catch {
      return realpathSync(symlink);
    }
  }

  // fallback: assume repo-root sibling layout (.wolfkrow/agents)
  return resolve(process.cwd(), '.wolfkrow', 'agents');
}

function dirname(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx === -1 ? '.' : p.slice(0, idx);
}
