import type { SecurityFinding, SecurityScanSummary } from '../entities/security-finding';

export interface SecurityAuditRunInput {
  scanId: string;
  projectPath: string;
  filesByRole: Record<string, string[]>;
  model: string;
  provider: unknown;
}

export interface SecurityAuditRunResult {
  scanId: string;
  findings: SecurityFinding[];
  summary: SecurityScanSummary;
}

export interface SecurityAuditRunner {
  run(input: SecurityAuditRunInput): Promise<SecurityAuditRunResult>;
}
