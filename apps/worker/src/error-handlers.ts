/**
 * Global process error handlers (FIX-020).
 *
 * Without these, an unhandled promise rejection or uncaught exception would
 * either crash the worker with no useful log, or (worse) leave it running in a
 * half-broken state. Here we always log the error with full context and exit
 * non-zero, so an external supervisor (systemd, Docker, pm2) restarts us into a
 * known-good state.
 */

import type { Logger } from './logger';

/**
 * Install `unhandledRejection` + `uncaughtException` handlers on the current
 * process. Both log the error and call `process.exit(1)`.
 *
 * Idempotent registration is the caller's responsibility — call once during
 * boot. Each event gets a dedicated handler bound to the provided logger.
 */
export function installGlobalErrorHandlers(logger: Logger): void {
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection — exiting');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}
