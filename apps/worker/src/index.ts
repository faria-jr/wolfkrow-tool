/**
 * Seed built-in agents for any existing user that owns zero agents.
 *
 * The worker owns the DB and runs after onboarding (web app creates the user;
 * next worker start seeds them). Safe to call on every restart: users that
 * already have agents are skipped — no duplicates, no overwrites, no resurrects.
 */
async function seedAgentsForExistingUsers(): Promise<void> {
  try {
    const repos = getRepos();
    const owner = await repos.user.findOwner();
    if (!owner) return;
    const dir = resolveSeedAgentsDir();
    const inserted = await ensureSeedAgents(repos.agent, owner.id, dir);
    if (inserted > 0) {
      logger.info({ userId: owner.id, count: inserted }, 'Seeded built-in agents');
    }
  } catch (err) {
    // Seeding must never block worker startup — log and continue.
    logger.error({ err }, 'Agent seeding failed (non-fatal)');
  }
}

/**
 * Wolfkrow background worker
 *
 * Runs scheduled tasks, migrations, and background jobs.
 */

import { getDb, runMigrations } from '@wolfkrow/infra';
import { getScheduledTasksRepository } from '@wolfkrow/infra/repos';

import { createAgentExecutor } from './agent-executor';
import { clearAllPendingPermissions, loadDecisionsFromDb } from './chat/permission-store';
import { config } from './config';
import { getRepos } from './container';
import { installGlobalErrorHandlers } from './error-handlers';
import { createLogger } from './logger';
import { loadBuiltInMcpCatalog } from './mcp/catalog';
import { stopMemoryLifecycle } from './memory/lifecycle';
import { mcpManager } from './routes/mcp';
import { Scheduler } from './scheduler';
import { resolveSeedAgentsDir } from './seed-agents/paths';
import { ensureSeedAgents } from './seed-agents/seeder';
import { ensureBuiltInChannels } from './seed-data/channels-seeder';
import { ensureBuiltInRules } from './seed-data/rules-seeder';
import { ensureBuiltInSkills } from './seed-data/skills-seeder';
import { createServer } from './server';

const logger = createLogger('worker');

// fail loud + log on any unhandled rejection / uncaught exception so
// the worker restarts into a known-good state instead of running half-broken.
installGlobalErrorHandlers(logger);

async function startMcpsAsync(): Promise<void> {
  const catalogEntries = loadBuiltInMcpCatalog().filter((s) => s.visibility === 'always');
  const dbEntries = getRepos()
    .mcpServer.findActive()
    .filter((r) => !catalogEntries.some((c) => c.name === r.name))
    .map((r) => ({ name: r.name, command: r.command, args: r.args, env: r.env }));

  const toStart = [...catalogEntries, ...dbEntries];
  await Promise.allSettled(
    toStart.map(async (entry) => {
      try {
        await mcpManager.start(entry);
        logger.info({ name: entry.name }, 'MCP server started');
      } catch (error) {
        logger.error({ name: entry.name, err: error }, 'Failed to start MCP server');
      }
    })
  );
}

async function seedBuiltInDataForOwner(): Promise<void> {
  try {
    const repos = getRepos();
    const owner = await repos.user.findOwner();
    if (!owner) return;

    await ensureBuiltInSkills(repos.skill, owner.id);
    await ensureBuiltInRules(repos.globalRule, owner.id);
    await ensureBuiltInChannels(owner.id);
  } catch (err) {
    logger.error({ err }, 'Built-in data seeding failed (non-fatal)');
  }
}

async function main(): Promise<void> {
  logger.info('Worker starting');

  runMigrations();
  getDb();

  await seedAgentsForExistingUsers();
  await seedBuiltInDataForOwner();

  // Warm the durable permission-decision cache from the DB so a restart does
  // NOT re-ask tools the user already approved/denied (P1-7 / Bug #3).
  // Best-effort: a failure logs and continues (cache stays empty → re-ask).
  try {
    loadDecisionsFromDb();
  } catch (err) {
    logger.error({ err }, 'Permission decision cache load failed (non-fatal)');
  }

  const repository = getScheduledTasksRepository();
  const executor = createAgentExecutor({ logger });
  const scheduler = new Scheduler({
    repository,
    executor,
    logger,
    pollIntervalMs: config.WORKER_POLL_INTERVAL_MS,
  });

  scheduler.start();

  // HTTP first — MCPs start async after server is ready ( )
  const server = await createServer();
  await server.listen({ host: config.HOST, port: config.PORT });
  logger.info(`Worker HTTP server listening on ${config.HOST}:${config.PORT}`);

  void startMcpsAsync();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down worker');
    scheduler.stop();
    clearAllPendingPermissions();
    stopMemoryLifecycle();
    void mcpManager.stopAll();
    void server
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        logger.error({ err }, 'Server close failed');
        process.exit(1);
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ err: error }, 'Worker failed to start');
  process.exit(1);
});

export { createServer } from './server';
export { config } from './config';
export { createMcpManager } from './mcp/manager';
export { loadBuiltInMcpCatalog } from './mcp/catalog';
