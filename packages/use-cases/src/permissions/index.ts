import { defaultPermissionResolver } from '@wolfkrow/domain';
import type { AgentPermissions, AuditRepo, AuditRow, PermissionResult } from '@wolfkrow/domain';

export type { AuditRepo, AuditRow } from '@wolfkrow/domain';

// --- Resolve Permission ---

export interface ResolvePermissionInput {
  agent: AgentPermissions;
  tool: string;
  input?: unknown;
}

export class ResolvePermissionUseCase {
  execute(input: ResolvePermissionInput): PermissionResult {
    return defaultPermissionResolver.resolve(input.agent, input.tool, input.input);
  }
}

// --- Record Audit Entry ---

export interface RecordAuditInput {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export class RecordAuditEntryUseCase {
  constructor(private readonly repo: AuditRepo) {}

  execute(input: RecordAuditInput): void {
    this.repo.insert({
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
      metadata: input.metadata ?? {},
      ...(input.ip !== undefined ? { ip: input.ip } : {}),
      timestamp: new Date(),
    });
  }
}

// --- Query Audit Log ---

export interface QueryAuditInput {
  userId: string;
  action?: string;
  resourceType?: string;
  since?: Date;
  limit?: number;
}

export class QueryAuditLogUseCase {
  constructor(private readonly repo: AuditRepo) {}

  execute(input: QueryAuditInput): AuditRow[] {
    return this.repo.findMany(input);
  }
}
