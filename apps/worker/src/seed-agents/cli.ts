/**
 * CLI entrypoint: manually re-seed agents for a user.
 *
 * Usage:
 *   pnpm --filter @wolfkrow/worker seed:agents -- --user <userId>
 *   pnpm --filter @wolfkrow/worker seed:agents -- --help
 *
 * NOTE: this is a manual escape hatch. Normal seeding happens automatically
 * at worker startup (see index.ts) for users that own zero agents. This CLI
 * is for re-seeding a specific user on demand (e.g. after adding new YAMLs).
 */

import { getDb, runMigrations } from '@wolfkrow/infra';

import { getRepos } from '../container';
import { createLogger } from '../logger';
import { resolveSeedAgentsDir } from './paths';
import { seedAgents } from './seeder';

const logger = createLogger('seed:agents');

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

const HELP = `Usage: seed:agents --user <userId>

Seed the 72 built-in wolfkrow agents for a user.

Options:
  --user <id>   The user id to seed agents for (required).
  --help, -h    Show this help.
`;

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (!args.user) {
    process.stderr.write('Error: --user <id> is required.\n\n');
    process.stderr.write(HELP);
    process.exit(1);
  }

  runMigrations();
  getDb();

  const repo = getRepos().agent;
  const dir = resolveSeedAgentsDir();
  const inserted = await seedAgents({ repo, userId: args.user, dir });
  logger.info({ userId: args.user, inserted }, 'Seed agents complete');
  process.stdout.write(`Seeded ${inserted} new agent(s) for user ${args.user}.\n`);
}

run().catch((err) => {
  logger.error({ err }, 'seed:agents failed');
  process.stderr.write(`seed:agents failed: ${String(err)}\n`);
  process.exit(1);
});
