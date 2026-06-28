import type { RunEvent } from '../entities/run-event';

export interface RunEventRepo {
  /** Persist a single event (append). */
  append(event: RunEvent): Promise<void>;
  /** Replay all events for a run in sequence order. */
  findByRunRef(runRef: string): Promise<RunEvent[]>;
  /** Clear the timeline for a run (called when a fresh run starts). */
  deleteByRunRef(runRef: string): Promise<void>;
}
