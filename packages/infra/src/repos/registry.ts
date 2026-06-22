/**
 * Repository registry — the infra-side composition root (FIX-007).
 *
 * Routes used to do `new DrizzleXxxRepo()` inline + import `@wolfkrow/infra`
 * directly, violating Clean Arch §1.1 (no infra in routes). This registry is
 * the single place Drizzle repos are instantiated; routes resolve repos through
 * the app container instead.
 *
 * Singleton: one instance per process (all repos share the singleton DB from
 * `getDb()` anyway, so caching avoids redundant wrappers). Pass `force: true`
 * only in tests after resetting the DB.
 *
 * Lives in `@wolfkrow/infra` (not `@wolfkrow/use-cases`) because infra owns
 * these adapters — use-cases must stay infra-agnostic and depend on ports only.
 */

import { getDb } from '../db/client';

import { DrizzleAgentRepo } from './agent-repo';
import { DrizzleAuditLogRepo } from './audit-log-repo';
import { DrizzleAuthAuditRepo } from './auth-audit-repo';
import { DrizzleDailySummaryRepo } from './daily-summary-repo';
import { DrizzleEnrichSessionRepo } from './enrich-session-repo';
import { DrizzleGlobalRuleRepo } from './global-rule-repo';
import { DrizzleHarnessProjectRepo } from './harness-project-repo';
import { DrizzleHarnessRoundRepo } from './harness-round-repo';
import { DrizzleHarnessSprintRepo } from './harness-sprint-repo';
import { DrizzleKnowledgeChunkRepo } from './knowledge-chunk-repo';
import { DrizzleKnowledgeDocRepo } from './knowledge-doc-repo';
import { DrizzleMcpServerRepo } from './mcp-server-repo';
import { DrizzleMcpToolRegistryRepo } from './mcp-tool-registry-repo';
import { DrizzlePipelinePhaseRepo } from './pipeline-phase-repo';
import { DrizzlePipelineProjectRepo } from './pipeline-project-repo';
import { DrizzleScheduledTaskRepo } from './scheduled-task-repo';
import { DrizzleSecretRepo } from './secret-repo';
import { DrizzleSemanticMemoryRepo } from './semantic-memory-repo';
import { DrizzleSkillRepo } from './skill-repo';
import { DrizzleTaskRepo } from './task-repo';
import { DrizzleTaskRunRepo } from './task-run-repo';
import { DrizzleTokenUsageRepo } from './token-usage-repo';
import { DrizzleUserRepo } from './user-repo';
import { DrizzleWorkflowRunRepo } from './workflow-run-repo';

export interface RepoRegistry {
  user: DrizzleUserRepo;
  agent: DrizzleAgentRepo;
  skill: DrizzleSkillRepo;
  secret: DrizzleSecretRepo;
  globalRule: DrizzleGlobalRuleRepo;
  auditLog: DrizzleAuditLogRepo;
  authAudit: DrizzleAuthAuditRepo;
  tokenUsage: DrizzleTokenUsageRepo;
  mcpServer: DrizzleMcpServerRepo;
  mcpToolRegistry: DrizzleMcpToolRegistryRepo;
  knowledgeDoc: DrizzleKnowledgeDocRepo;
  knowledgeChunk: DrizzleKnowledgeChunkRepo;
  semanticMemory: DrizzleSemanticMemoryRepo;
  dailySummary: DrizzleDailySummaryRepo;
  scheduledTask: DrizzleScheduledTaskRepo;
  taskRun: DrizzleTaskRunRepo;
  task: DrizzleTaskRepo;
  harnessProject: DrizzleHarnessProjectRepo;
  harnessSprint: DrizzleHarnessSprintRepo;
  harnessRound: DrizzleHarnessRoundRepo;
  pipelineProject: DrizzlePipelineProjectRepo;
  pipelinePhase: DrizzlePipelinePhaseRepo;
  enrichSession: DrizzleEnrichSessionRepo;
  workflowRun: DrizzleWorkflowRunRepo;
}

let _registry: RepoRegistry | null = null;

export function createRepoRegistry(force = false): RepoRegistry {
  if (_registry && !force) return _registry;
  // Touch getDb() once so a missing DB / failed migration surfaces here, at the
  // composition root, rather than deep inside the first repo call.
  const db = getDb();
  _registry = {
    user: new DrizzleUserRepo(db),
    agent: new DrizzleAgentRepo(db),
    skill: new DrizzleSkillRepo(db),
    secret: new DrizzleSecretRepo(db),
    globalRule: new DrizzleGlobalRuleRepo(db),
    auditLog: new DrizzleAuditLogRepo(db),
    authAudit: new DrizzleAuthAuditRepo(db),
    tokenUsage: new DrizzleTokenUsageRepo(db),
    mcpServer: new DrizzleMcpServerRepo(db),
    mcpToolRegistry: new DrizzleMcpToolRegistryRepo(db),
    knowledgeDoc: new DrizzleKnowledgeDocRepo(db),
    knowledgeChunk: new DrizzleKnowledgeChunkRepo(db),
    semanticMemory: new DrizzleSemanticMemoryRepo(db),
    dailySummary: new DrizzleDailySummaryRepo(db),
    scheduledTask: new DrizzleScheduledTaskRepo(db),
    taskRun: new DrizzleTaskRunRepo(db),
    task: new DrizzleTaskRepo(db),
    harnessProject: new DrizzleHarnessProjectRepo(db),
    harnessSprint: new DrizzleHarnessSprintRepo(db),
    harnessRound: new DrizzleHarnessRoundRepo(db),
    pipelineProject: new DrizzlePipelineProjectRepo(db),
    pipelinePhase: new DrizzlePipelinePhaseRepo(db),
    enrichSession: new DrizzleEnrichSessionRepo(db),
    workflowRun: new DrizzleWorkflowRunRepo(db),
  };
  return _registry;
}

/** Test helper: drop the cached singleton (use after `resetDb` in tests). */
export function resetRepoRegistry(): void {
  _registry = null;
}
