import type { Logger } from '../../logger';

import type { DreamingGate } from './gate';

/**
 * One DreamingGate per user, created lazily on first activity and kept alive
 * for the worker's lifetime. The factory decouples construction (which needs
 * a DailySummaryRepo from the container) from the registry logic so the
 * registry stays unit-testable.
 */
export interface DreamingGateFactory {
  create(userId: string): DreamingGate;
}

export class DreamingGateRegistry {
  private readonly gates = new Map<string, DreamingGate>();

  constructor(
    private readonly factory: DreamingGateFactory,
    private readonly logger?: Logger,
  ) {}

  recordActivity(userId: string): void {
    let gate = this.gates.get(userId);
    if (!gate) {
      gate = this.factory.create(userId);
      gate.start();
      this.gates.set(userId, gate);
      this.logger?.info({ userId }, 'Dreaming gate started for user');
    }
    gate.recordActivity();
  }

  stopAll(): void {
    for (const gate of this.gates.values()) gate.stop();
    this.gates.clear();
  }
}
