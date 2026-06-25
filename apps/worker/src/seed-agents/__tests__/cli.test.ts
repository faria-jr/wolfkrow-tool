/**
 * seed:agents CLI parseArgs — pure argument parsing.
 *
 * The run() entrypoint needs a live DB and is invoked only as a process entry
 * point; parseArgs itself is a pure function and fully testable.
 */

import { describe, it, expect } from 'vitest';

import { parseArgs } from '../cli';

describe('parseArgs', () => {
  it('parses --user <id>', () => {
    expect(parseArgs(['--user', 'u-1'])).toEqual({ user: 'u-1', help: false });
  });

  it('parses --help', () => {
    expect(parseArgs(['--help'])).toEqual({ user: null, help: true });
  });

  it('parses -h short form', () => {
    expect(parseArgs(['-h'])).toEqual({ user: null, help: true });
  });

  it('returns null user when --user has no value', () => {
    expect(parseArgs(['--user'])).toEqual({ user: null, help: false });
  });

  it('ignores unknown flags', () => {
    expect(parseArgs(['--unknown', 'x', '--user', 'u'])).toEqual({ user: 'u', help: false });
  });

  it('returns defaults for an empty argv', () => {
    expect(parseArgs([])).toEqual({ user: null, help: false });
  });
});
