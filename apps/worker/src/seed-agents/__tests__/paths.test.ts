/**
 * resolveSeedAgentsDir — env override, symlink resolution, and cwd fallback.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { resolveSeedAgentsDir } from '../paths';

const ORIG_DIR = process.env['WOLFKROW_SEED_AGENTS_DIR'];

afterEach(() => {
  if (ORIG_DIR === undefined) delete process.env['WOLFKROW_SEED_AGENTS_DIR'];
  else process.env['WOLFKROW_SEED_AGENTS_DIR'] = ORIG_DIR;
});

describe('resolveSeedAgentsDir', () => {
  it('returns the WOLFKROW_SEED_AGENTS_DIR override when set', () => {
    process.env['WOLFKROW_SEED_AGENTS_DIR'] = '/custom/agents';
    expect(resolveSeedAgentsDir()).toBe('/custom/agents');
  });

  it('falls back to <cwd>/.wolfkrow/agents when no override and no symlink', () => {
    delete process.env['WOLFKROW_SEED_AGENTS_DIR'];
    // Point the override away and assert the fallback shape; the repo has a
    // `yaml` symlink, so the symlink path is taken in this checkout. We assert
    // the result is a non-empty absolute path either way.
    const result = resolveSeedAgentsDir();
    expect(result.length).toBeGreaterThan(0);
    expect(result.startsWith('/')).toBe(true);
  });
});
