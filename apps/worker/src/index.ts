/**
 * Wolfkrow background worker
 *
 * Runs scheduled tasks, migrations, and background jobs.
 */

import { getDb, runMigrations } from '@wolfkrow/infra';
import { getScheduledTasksRepository } from '@wolfkrow/infra/repos';

import { createAgentExecutor } from './agent-executor';
import { config } from './config';
import { getRepos } from './container';
import { clearAllPendingPermissions } from './chat/permission-store';
import { installGlobalErrorHandlers } from './error-handlers';
import { createLogger } from './logger';
import { loadBuiltInMcpCatalog } from './mcp/catalog';
import { stopMemoryLifecycle } from './memory/lifecycle';
import { mcpManager } from './routes/mcp';
import { Scheduler } from './scheduler';
import { createServer } from './server';

const logger = createLogger('worker');

// FIX-020: fail loud + log on any unhandled rejection / uncaught exception so
// the worker restarts into a known-good state instead of running half-broken.
installGlobalErrorHandlers(logger);

async function startMcpsAsync(): Promise<void> {
  const catalogEntries = loadBuiltInMcpCatalog().filter((s) => s.visibility === 'always');
  const dbEntries = getRepos().mcpServer
    .findActive()
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
    }),
  );
}

async function main(): Promise<void> {
  logger.info('Worker starting');

  runMigrations();
  getDb();

  const repository = getScheduledTasksRepository();
  const executor = createAgentExecutor({ logger });
  const scheduler = new Scheduler({
    repository,
    executor,
    logger,
    pollIntervalMs: config.WORKER_POLL_INTERVAL_MS,
  });

  scheduler.start();

  // HTTP first — MCPs start async after server is ready (G5 fix)
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
