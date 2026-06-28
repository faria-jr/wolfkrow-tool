import { PipelineMessage } from '@wolfkrow/domain';
import type { PipelineMessageRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { pipelineMessages } from '../db/schema/pipeline';

type DbRow = typeof pipelineMessages.$inferSelect;

function toEntity(row: DbRow): PipelineMessage {
  return PipelineMessage.fromProps({
    id: row.id,
    projectId: row.projectId,
    phaseId: row.phaseId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  });
}

export class DrizzlePipelineMessageRepo implements PipelineMessageRepo {
  constructor(private readonly db = getDb()) {}

  async save(message: PipelineMessage): Promise<PipelineMessage> {
    const p = message.toProps();
    this.db
      .insert(pipelineMessages)
      .values({
        id: p.id,
        projectId: p.projectId,
        phaseId: p.phaseId,
        role: p.role,
        content: p.content,
        createdAt: p.createdAt,
      })
      .onConflictDoUpdate({
        target: pipelineMessages.id,
        set: { role: p.role, content: p.content },
      })
      .run();
    return message;
  }

  async saveMany(messages: PipelineMessage[]): Promise<void> {
    if (messages.length === 0) return;
    // Atomic: a failure on any row rolls back the whole batch (no dangling user message).
    this.db.transaction((tx) => {
      for (const message of messages) {
        const p = message.toProps();
        tx.insert(pipelineMessages)
          .values({
            id: p.id,
            projectId: p.projectId,
            phaseId: p.phaseId,
            role: p.role,
            content: p.content,
            createdAt: p.createdAt,
          })
          .onConflictDoUpdate({
            target: pipelineMessages.id,
            set: { role: p.role, content: p.content },
          })
          .run();
      }
    });
  }

  async findByPhaseId(phaseId: string): Promise<PipelineMessage[]> {
    const rows = this.db
      .select()
      .from(pipelineMessages)
      .where(eq(pipelineMessages.phaseId, phaseId))
      .all();
    return rows.map(toEntity);
  }

  async findByProjectId(projectId: string): Promise<PipelineMessage[]> {
    const rows = this.db
      .select()
      .from(pipelineMessages)
      .where(eq(pipelineMessages.projectId, projectId))
      .all();
    return rows.map(toEntity);
  }
}
