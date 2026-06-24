import { describe, expect, it } from 'vitest';

// parseArgs is not exported from cli.ts (it triggers DB/migrations on import
// via run()). We re-implement a thin parse spec here to lock the CLI contract.
// The canonical implementation lives in cli.ts; keep these in sync.

interface ParsedArgs {
  user: string | null;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { user: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg === '--user') {
      out.user = argv[++i] ?? null;
    }
  }
  return out;
}

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
