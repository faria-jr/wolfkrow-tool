import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveDbPath } from '../client';

const ORIG_ENV = process.env.WOLFKROW_DB_PATH;

afterEach(() => {
  if (ORIG_ENV === undefined) delete process.env.WOLFKROW_DB_PATH;
  else process.env.WOLFKROW_DB_PATH = ORIG_ENV;
});

describe('resolveDbPath', () => {
  it('uses the explicit param when provided (absolute)', () => {
    expect(resolveDbPath('/var/wk/test.db')).toBe(path.resolve('/var/wk/test.db'));
  });

  it('falls back to WOLFKROW_DB_PATH env when no param', () => {
    process.env.WOLFKROW_DB_PATH = '/var/wk/env.db';
    expect(resolveDbPath()).toBe(path.resolve('/var/wk/env.db'));
  });

  it('defaults to a homedir-based path (cwd-independent) when nothing is set', () => {
    delete process.env.WOLFKROW_DB_PATH;
    const expected = path.join(
      // os.homedir() resolved at runtime; build the same shape the source uses
      process.env.HOME ?? process.env.USERPROFILE ?? '',
      '.wolfkrow',
      'data',
      'wolfkrow.db'
    );
    expect(resolveDbPath()).toBe(expected);
  });

  it('explicit param takes precedence over the env var', () => {
    process.env.WOLFKROW_DB_PATH = '/var/wk/env.db';
    expect(resolveDbPath('/var/wk/explicit.db')).toBe(path.resolve('/var/wk/explicit.db'));
  });

  it('is independent of process.cwd()', () => {
    delete process.env.WOLFKROW_DB_PATH;
    const before = resolveDbPath();
    const origCwd = process.cwd();
    try {
      process.chdir(tmpdir());
      expect(resolveDbPath()).toBe(before);
    } finally {
      process.chdir(origCwd);
    }
  });
});
