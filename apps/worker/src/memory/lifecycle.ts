/**
 * Memory lifecycle wiring (FIX-012 + FIX-013).
 *
 * `recordChatTurn` is the single entry point the chat route calls after a turn:
 * it kicks off memory extraction (FIX-012, fire-and-forget) and keeps the user's
 * dreaming gate alive (FIX-013, lazy per-user registry). Nothing here throws on
 * failure — memory is best-effort and must never break the chat response.
 */

import { getAdapters, getRepos } from '../container';
import type { Logger } from '../logger';

import { DreamingGate } from './dreaming/gate';
import { DreamingGateRegistry } from './dreaming/registry';
import type { DreamingGateFactory } from './dreaming/registry';
import { MemoryPipeline } from './pipeline';
import type { SessionMessage } from './pipeline';

let registry: DreamingGateRegistry | null = null;

function createFactory(logger: Logger): DreamingGateFactory {
  return {
    create: (userId) => new DreamingGate(getRepos().dailySummary, { userId }, logger),
  };
}

export function getDreamingRegistry(logger: Logger): DreamingGateRegistry {
  if (!registry) registry = new DreamingGateRegistry(createFactory(logger), logger);
  return registry;
}

async function runMemoryExtraction(userId: string, messages: SessionMessage[]): Promise<void> {
  const pipeline = new MemoryPipeline(getRepos().semanticMemory, getAdapters().embedder);
  await pipeline.extractAndStore(userId, messages);
}

/**
 * Fire-and-forget memory capture for a chat turn. Extraction errors are logged,
 * not thrown; dreaming activity is recorded synchronously so the idle timer
 * resets even if extraction is still in flight.
 */
export function recordChatTurn(logger: Logger, userId: string, messages: SessionMessage[]): void {
  void runMemoryExtraction(userId, messages).catch((err) => {
    logger.error({ err, userId }, 'Memory extraction failed');
  });
  getDreamingRegistry(logger).recordActivity(userId);
}

/** Stop all dreaming gates — call on worker shutdown. */
export function stopMemoryLifecycle(): void {
  registry?.stopAll();
  registry = null;
}

/** Test-only: drop the singleton so tests start from a clean slate. */
export function resetMemoryLifecycle(): void {
  registry = null;
}
