import type { SecurityFinding } from '../entities/security-finding';

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

export interface SecurityScanRepo {
  create(input: { userId: string; projectPath: string }): SecurityScanRecord;
  findById(scanId: string): SecurityScanRecord | null;
  listByUser(userId: string, limit?: number): SecurityScanRecord[];
  update(scanId: string, patch: Partial<Pick<SecurityScanRecord, 'status' | 'summary' | 'completedAt' | 'error'>>): void;
}

export interface SecurityFindingRepo {
  insertMany(findings: SecurityFinding[]): void;
  findByScan(scanId: string): SecurityFinding[];
}
