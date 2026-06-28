import { RunEvent, type RunEventRepo, type WorkflowKind } from '@wolfkrow/domain';

/**
 * Record a run event to the persisted timeline (append-only).
 *
 * The seq is computed from the current max seq for the runRef so replay is
 * deterministic. Called by the workflow SSE loop on every emitted event.
 */
export class RecordRunEventUseCase {
  constructor(private readonly repo: RunEventRepo) {}

  async execute(input: {
    runRef: string;
    workflow: WorkflowKind;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const existing = await this.repo.findByRunRef(input.runRef);
    const seq = existing.reduce((max, e) => Math.max(max, e.seq), -1) + 1;
    await this.repo.append(
      RunEvent.create({ ...input, seq })
    );
  }
}

/** Replay the persisted timeline for a run, in sequence order (console restore). */
export class ReplayRunEventsUseCase {
  constructor(private readonly repo: RunEventRepo) {}

  async execute(runRef: string): Promise<{ events: RunEvent[] }> {
    return { events: await this.repo.findByRunRef(runRef) };
  }
}

/** Clear the timeline when a fresh run starts so replay shows only the new run. */
export class ClearRunEventsUseCase {
  constructor(private readonly repo: RunEventRepo) {}

  async execute(runRef: string): Promise<void> {
    await this.repo.deleteByRunRef(runRef);
  }
}
