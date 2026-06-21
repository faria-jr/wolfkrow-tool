/**
 * Repository helpers for scheduled tasks and task runs
 */

import { and, eq, lte } from 'drizzle-orm';

export type { Entity } from './base';
export { DrizzleRepo, InMemoryRepo } from './base';
export { DrizzleUserRepo } from './user-repo';
export { DrizzleAgentRepo } from './agent-repo';
export { DrizzleSkillRepo } from './skill-repo';
export { DrizzleMcpServerRepo } from './mcp-server-repo';
export type { McpServerRecord, McpServerCreateInput } from './mcp-server-repo';
export { DrizzleAuthAuditRepo } from './auth-audit-repo';
export type { AuthAuditEntry, AuthAuditAction } from './auth-audit-repo';
export { DrizzleMcpToolRegistryRepo } from './mcp-tool-registry-repo';
export type { McpToolRecord } from './mcp-tool-registry-repo';
export { DrizzleKnowledgeDocRepo } from './knowledge-doc-repo';
export { DrizzleKnowledgeChunkRepo } from './knowledge-chunk-repo';
export { DrizzleSemanticMemoryRepo } from './semantic-memory-repo';
export { DrizzleDailySummaryRepo } from './daily-summary-repo';
export { DrizzleScheduledTaskRepo } from './scheduled-task-repo';
export { DrizzleTaskRunRepo } from './task-run-repo';
export { DrizzleHarnessProjectRepo } from './harness-project-repo';
export { DrizzleHarnessSprintRepo } from './harness-sprint-repo';
export { DrizzleHarnessRoundRepo } from './harness-round-repo';
export { DrizzlePipelineProjectRepo } from './pipeline-project-repo';
export { DrizzlePipelinePhaseRepo } from './pipeline-phase-repo';
export { DrizzleEnrichSessionRepo } from './enrich-session-repo';
export { DrizzleWorkflowRunRepo } from './workflow-run-repo';
export { DrizzleSecretRepo } from './secret-repo';
export { DrizzleTokenUsageRepo } from './token-usage-repo';
export type { TokenUsageRecord, TokenUsageFilter, TokenUsageSource } from './token-usage-repo';
export { DrizzleGlobalRuleRepo } from './global-rule-repo';
export { DrizzleAuditLogRepo } from './audit-log-repo';
export type { AuditEntry, AuditFilter, AuditAction } from './audit-log-repo';

import { getDb } from '../db/client';
import { scheduledTasks, taskRuns } from '../db/schema/scheduler';

export function getScheduledTasksRepository() {
  const db = getDb();

  return {
    findEnabledTasksDueBy(now: Date) {
      return db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.enabled, true),
            lte(scheduledTasks.nextRunAt, now)
          )
        )
        .all();
    },

    updateNextRun(taskId: string, nextRunAt: Date) {
      return db
        .update(scheduledTasks)
        .set({ nextRunAt, lastRunAt: new Date() })
        .where(eq(scheduledTasks.id, taskId))
        .run();
    },

    disable(taskId: string) {
      return db
        .update(scheduledTasks)
        .set({ enabled: false })
        .where(eq(scheduledTasks.id, taskId))
        .run();
    },

    createRun(values: {
      id: string;
      taskId: string;
      status: 'pending' | 'running' | 'awaiting_review' | 'validated' | 'rejected';
      startedAt: Date;
      output?: Record<string, unknown>;
      error?: string;
    }) {
      return db.insert(taskRuns).values(values).run();
    },

    completeRun(
      runId: string,
      values: {
        status: 'awaiting_review' | 'validated' | 'rejected';
        completedAt: Date;
        output?: Record<string, unknown>;
        error?: string;
      }
    ) {
      return db.update(taskRuns).set(values).where(eq(taskRuns.id, runId)).run();
    },
  };
}

export type ScheduledTasksRepository = ReturnType<typeof getScheduledTasksRepository>;
