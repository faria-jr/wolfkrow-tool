import { RunEvent, type RunEventRepo } from '@wolfkrow/domain';
import { asc, eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { runEvents } from '../db/schema/run-events';

import { fromJson } from './json-field';

type DbRow = typeof runEvents.$inferSelect;

function toEntity(row: DbRow): RunEvent {
  return RunEvent.fromProps({
    id: row.id,
    runRef: row.runRef,
    workflow: row.workflow,
    eventType: row.eventType,
    payload: fromJson<Record<string, unknown>>(row.payload, {}),
    seq: row.seq,
    createdAt: row.createdAt,
  });
}

export class DrizzleRunEventRepo implements RunEventRepo {
  constructor(private readonly db = getDb()) {}

  async append(event: RunEvent): Promise<void> {
    const p = event.toProps();
    this.db
      .insert(runEvents)
      .values({
        id: p.id,
        runRef: p.runRef,
        workflow: p.workflow,
        eventType: p.eventType,
        payload: p.payload,
        seq: p.seq,
        createdAt: p.createdAt,
      })
      .run();
  }

  async findByRunRef(runRef: string): Promise<RunEvent[]> {
    const rows = this.db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runRef, runRef))
      .orderBy(asc(runEvents.seq))
      .all();
    return rows.map(toEntity);
  }

  async deleteByRunRef(runRef: string): Promise<void> {
    this.db.delete(runEvents).where(eq(runEvents.runRef, runRef)).run();
  }
}
