import { randomUUID } from 'node:crypto';

import { SecurityFinding, type SecuritySeverity, type SecurityDimension } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { securityFindings, securityScans } from '../db/schema/security-audit';

type Db = ReturnType<typeof getDb>;
type FindingRow = typeof securityFindings.$inferSelect;
type ScanRow = typeof securityScans.$inferSelect;

export interface SecurityScanRecord {
  id: string;
  userId: string;
  projectPath: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: Record<string, unknown>;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export class DrizzleSecurityScanRepo {
  constructor(private readonly db: Db = getDb()) {}

  create(input: { userId: string; projectPath: string }): SecurityScanRecord {
    const id = randomUUID();
    const now = new Date();
    this.db
      .insert(securityScans)
      .values({
        id,
        userId: input.userId,
        projectPath: input.projectPath,
        status: 'pending',
        summary: {},
        startedAt: now,
        completedAt: null,
        error: null,
      })
      .run();
    return {
      id,
      userId: input.userId,
      projectPath: input.projectPath,
      status: 'pending',
      summary: {},
      startedAt: now,
      completedAt: null,
      error: null,
    };
  }

  findById(scanId: string): SecurityScanRecord | null {
    const row = this.db.select().from(securityScans).where(eq(securityScans.id, scanId)).get();
    return row ? this.toRecord(row) : null;
  }

  listByUser(userId: string, limit = 50): SecurityScanRecord[] {
    const rows = this.db
      .select()
      .from(securityScans)
      .where(eq(securityScans.userId, userId))
      .orderBy(securityScans.startedAt)
      .all();
    return rows
      .slice(-limit)
      .reverse()
      .map((r) => this.toRecord(r));
  }

  update(
    scanId: string,
    patch: Partial<Pick<SecurityScanRecord, 'status' | 'summary' | 'completedAt' | 'error'>>
  ): void {
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set['status'] = patch.status;
    if (patch.summary !== undefined) set['summary'] = patch.summary;
    if (patch.completedAt !== undefined) set['completedAt'] = patch.completedAt;
    if (patch.error !== undefined) set['error'] = patch.error;
    if (Object.keys(set).length === 0) return;
    this.db.update(securityScans).set(set).where(eq(securityScans.id, scanId)).run();
  }

  private toRecord(r: ScanRow): SecurityScanRecord {
    return {
      id: r.id,
      userId: r.userId,
      projectPath: r.projectPath,
      status: r.status as SecurityScanRecord['status'],
      summary: (r.summary ?? {}) as Record<string, unknown>,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      error: r.error,
    };
  }
}

export class DrizzleSecurityFindingRepo {
  constructor(private readonly db: Db = getDb()) {}

  insertMany(findings: SecurityFinding[]): void {
    if (findings.length === 0) return;
    const rows = findings.map((f) => ({
      id: randomUUID(),
      scanId: f.scanId,
      severity: f.severity,
      dimension: f.dimension,
      file: f.file,
      ...(f.line !== undefined ? { line: f.line } : {}),
      message: f.message,
      ...(f.rule !== undefined ? { rule: f.rule } : {}),
      ...(f.agentId !== undefined ? { agentId: f.agentId } : {}),
      createdAt: f.createdAt,
    }));
    this.db.insert(securityFindings).values(rows).run();
  }

  findByScan(scanId: string): SecurityFinding[] {
    const rows = this.db
      .select()
      .from(securityFindings)
      .where(eq(securityFindings.scanId, scanId))
      .all();
    return rows.map((r) => this.toEntity(r));
  }

  private toEntity(r: FindingRow): SecurityFinding {
    const props: Parameters<typeof SecurityFinding.create>[0] = {
      scanId: r.scanId,
      severity: r.severity as SecuritySeverity,
      dimension: r.dimension as SecurityDimension,
      file: r.file,
      message: r.message,
      createdAt: r.createdAt,
    };
    if (r.id) props.id = r.id;
    if (r.line !== null) props.line = r.line;
    if (r.rule) props.rule = r.rule;
    if (r.agentId) props.agentId = r.agentId;
    return SecurityFinding.create(props);
  }
}
