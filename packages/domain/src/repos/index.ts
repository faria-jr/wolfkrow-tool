/**
 * Ports de repositório (interfaces). O domínio define os contratos; a infra
 * implementa (DrizzleXxxRepo / InMemoryXxxRepo). Repos específicos por entidade
 * (UserRepo, SessionRepo...) são adicionados nas fases que criam a entidade.
 */

/** Port base genérico — CRUD mínimo. Sub-interfaces estendem com queries. */
export interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
}

export type { UserRepo } from './user-repo';
export type { ChatSessionRepo, MessageRepo } from './chat-repos';
export type { AgentRepo } from './agent-repo';
export type { SkillRepo } from './skill-repo';
export type { KnowledgeDocRepo, KnowledgeChunkRepo, ChunkSearchResult, KeywordSearchResult } from './knowledge-repos';
export type { SemanticMemoryRepo, DailySummaryRepo, MemorySearchResult } from './memory-repos';
export type { ScheduledTaskRepo, TaskRunRepo } from './scheduler-repos';
export type { HarnessProjectRepo, HarnessSprintRepo, HarnessRoundRepo } from './harness-repos';
export type { PipelineProjectRepo, PipelinePhaseRepo } from './pipeline-repos';
export type { EnrichSessionRepo } from './enrich-repos';
export type { WorkflowRunRepo } from './workflow-repos';
export type { UsageRepo, UsageRecord, UsageRecordInput, UsageFilter, UsageCostFilter } from './usage-repo';
export type { AuditRepo, AuditRow, AuditEntryInput, AuditFilter } from './audit-log-repo';
export type { McpServerRepo, McpServerRecord, McpServerCreateInput, McpServerVisibility } from './mcp-server-repo';
export type { McpToolRegistryRepo, McpToolRecord, McpToolInput } from './mcp-tool-registry-repo';
export type { AuthAuditRepo, AuthAuditEntry } from './auth-audit-repo';
