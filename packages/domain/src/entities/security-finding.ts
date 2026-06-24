export const SECURITY_SEVERITIES = ['info', 'warning', 'major', 'critical', 'blocker'] as const;
export type SecuritySeverity = (typeof SECURITY_SEVERITIES)[number];

export const SECURITY_DIMENSIONS = [
  'secrets',
  'auth',
  'isolation',
  'duplication',
  'logic',
  'standards',
  'owasp',
  'general',
] as const;
export type SecurityDimension = (typeof SECURITY_DIMENSIONS)[number];

export interface SecurityFindingProps {
  id?: string;
  scanId: string;
  severity: SecuritySeverity;
  dimension: SecurityDimension;
  file: string;
  line?: number;
  message: string;
  rule?: string;
  agentId?: string;
  createdAt?: Date;
}

export class SecurityFinding {
  private constructor(private readonly props: SecurityFindingProps) {}

  static create(props: SecurityFindingProps): SecurityFinding {
    if (!props.scanId) throw new Error('SecurityFinding: scanId required');
    if (!SECURITY_SEVERITIES.includes(props.severity)) {
      throw new Error(`SecurityFinding: invalid severity ${props.severity}`);
    }
    if (!props.file) throw new Error('SecurityFinding: file required');
    if (!props.message) throw new Error('SecurityFinding: message required');
    if (!SECURITY_DIMENSIONS.includes(props.dimension)) {
      throw new Error(`SecurityFinding: invalid dimension ${props.dimension}`);
    }
    return new SecurityFinding(props);
  }

  get id(): string | undefined { return this.props.id; }
  get scanId(): string { return this.props.scanId; }
  get severity(): SecuritySeverity { return this.props.severity; }
  get dimension(): SecurityDimension { return this.props.dimension; }
  get file(): string { return this.props.file; }
  get line(): number | undefined { return this.props.line; }
  get message(): string { return this.props.message; }
  get rule(): string | undefined { return this.props.rule; }
  get agentId(): string | undefined { return this.props.agentId; }
  get createdAt(): Date { return this.props.createdAt ?? new Date(); }

  toJSON(): SecurityFindingProps {
    return { ...this.props, createdAt: this.createdAt };
  }
}

export interface SecurityScanSummary {
  total: number;
  bySeverity: Record<SecuritySeverity, number>;
  byDimension: Record<SecurityDimension, number>;
}

export function summarizeFindings(findings: readonly SecurityFinding[]): SecurityScanSummary {
  const bySeverity: Record<SecuritySeverity, number> = {
    info: 0, warning: 0, major: 0, critical: 0, blocker: 0,
  };
  const byDimension: Record<SecurityDimension, number> = {
    secrets: 0, auth: 0, isolation: 0, duplication: 0, logic: 0,
    standards: 0, owasp: 0, general: 0,
  };
  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byDimension[f.dimension] += 1;
  }
  return { total: findings.length, bySeverity, byDimension };
}
