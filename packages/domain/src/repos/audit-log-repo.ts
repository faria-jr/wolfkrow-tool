/**
 * Port de repositório de audit log .
 *
 * Antes `AuditRepo`/`AuditRow` viviam em `@wolfkrow/use-cases` (permissions) e
 * `DrizzleAuditLogRepo` não o implementava — a rota fazia `as never`. Movido
 * para o domínio: `action` é `string` na fronteira (a infra restringe ao enum
 * da coluna na escrita).
 */

export interface AuditRow {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | undefined;
  metadata: Record<string, unknown>;
  ip: string | undefined;
  timestamp: Date;
}

export interface AuditEntryInput {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  ip?: string;
  timestamp: Date;
}

export interface AuditFilter {
  userId: string;
  action?: string;
  resourceType?: string;
  since?: Date;
  limit?: number;
}

export interface AuditRepo {
  insert(entry: AuditEntryInput): void;
  findMany(filter: AuditFilter): AuditRow[];
}
