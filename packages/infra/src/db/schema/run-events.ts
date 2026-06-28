/**
 * Drizzle schema — Run Events (append-only timeline for console restore).
 *
 * Each row is one SSE-shaped event emitted by a long-running workflow
 * (Harness coder/evaluator stream, Pipeline phase stream). Keyed by `runRef`
 * so the console can replay the timeline after a reconnect/refresh.
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { id, timestamp, metadata, shortText } from './base';

export const runEvents = sqliteTable(
  'run_events',
  {
    id: id(),
    /** Composite reference, e.g. `harness:<projectId>` / `pipeline:<phaseId>`. */
    runRef: shortText('run_ref').notNull(),
    workflow: text('workflow', { enum: ['harness', 'pipeline'] }).notNull(),
    eventType: shortText('event_type').notNull(),
    payload: metadata(),
    /** Monotonic sequence within a runRef for deterministic replay. */
    seq: integer('seq').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    runRefIdx: index('run_events_run_ref_idx').on(t.runRef),
    runRefSeqIdx: index('run_events_run_ref_seq_idx').on(t.runRef, t.seq),
  })
);
