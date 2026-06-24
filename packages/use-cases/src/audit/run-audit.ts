import type { SecurityFinding, SecurityFindingRepo, SecurityScanRecord, SecurityScanRepo, SecurityAuditRunner, SecurityScanSummary } from '@wolfkrow/domain';

export interface RunAuditInput {
  userId: string;
  projectPath: string;
  model?: string;
  filesByRole?: Record<string, string[]>;
  provider: unknown;
  runner: SecurityAuditRunner;
}

export interface RunAuditOutput {
  scanId: string;
  status: 'completed' | 'failed';
  findingCount: number;
  summary: SecurityScanSummary;
  error?: string;
}

export class RunAuditUseCase {
  constructor(
    private readonly scanRepo: SecurityScanRepo,
    private readonly findingRepo: SecurityFindingRepo,
  ) {}

  async execute(input: RunAuditInput): Promise<RunAuditOutput> {
    const scan = this.scanRepo.create({ userId: input.userId, projectPath: input.projectPath });
    this.scanRepo.update(scan.id, { status: 'running' });

    try {
      const result = await input.runner.run({
        scanId: scan.id,
        projectPath: input.projectPath,
        filesByRole: input.filesByRole ?? {},
        model: input.model ?? 'claude-haiku-4-5-20251001',
        provider: input.provider,
      });
      this.findingRepo.insertMany(result.findings);
      this.scanRepo.update(scan.id, {
        status: 'completed',
        completedAt: new Date(),
        summary: result.summary as unknown as Record<string, unknown>,
      });
      return {
        scanId: scan.id,
        status: 'completed',
        findingCount: result.findings.length,
        summary: result.summary,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.scanRepo.update(scan.id, {
        status: 'failed',
        completedAt: new Date(),
        error: message,
      });
      return {
        scanId: scan.id,
        status: 'failed',
        findingCount: 0,
        summary: {
          total: 0,
          bySeverity: { info: 0, warning: 0, major: 0, critical: 0, blocker: 0 },
          byDimension: {
            secrets: 0, auth: 0, isolation: 0, duplication: 0, logic: 0,
            standards: 0, owasp: 0, general: 0,
          },
        },
        error: message,
      };
    }
  }
}

export class ListFindingsUseCase {
  constructor(
    private readonly scanRepo: SecurityScanRepo,
    private readonly findingRepo: SecurityFindingRepo,
  ) {}

  async execute(input: { scanId: string; userId: string }): Promise<{ scan: SecurityScanRecord | null; findings: SecurityFinding[] }> {
    const scan = this.scanRepo.findById(input.scanId);
    if (!scan) return { scan: null, findings: [] };
    const findings = this.findingRepo.findByScan(input.scanId);
    return { scan, findings };
  }
}

export class ListScansUseCase {
  constructor(private readonly scanRepo: SecurityScanRepo) {}

  async execute(input: { userId: string; limit?: number }): Promise<SecurityScanRecord[]> {
    return this.scanRepo.listByUser(input.userId, input.limit);
  }
}
