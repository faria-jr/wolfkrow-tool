import { describe, expect, it } from 'vitest';

import { parseArgs } from './cli';

describe('seed:agents cli arg parsing', () => {
  it('parses --user <id>', () => {
    expect(parseArgs(['--user', 'u-123'])).toEqual({ user: 'u-123', help: false });
  });

  it('parses --help and -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('defaults user to null when absent', () => {
    expect(parseArgs([]).user).toBeNull();
  });

  it('treats --user without a following value as null', () => {
    expect(parseArgs(['--user']).user).toBeNull();
  });

  it('ignores unknown flags', () => {
    expect(parseArgs(['--user', 'u1', '--verbose'])).toEqual({
      user: 'u1',
      help: false,
    });
  });
});
