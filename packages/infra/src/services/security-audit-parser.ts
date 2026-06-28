import type { SecuritySeverity } from '@wolfkrow/domain';

import type { ParsedFinding } from './security-audit-runner';

const VALID_SEVERITIES: readonly SecuritySeverity[] = [
  'info',
  'warning',
  'major',
  'critical',
  'blocker',
];

function isValidBaseField(severity: unknown, file: unknown, message: unknown): boolean {
  return (
    typeof severity === 'string' &&
    VALID_SEVERITIES.includes(severity as SecuritySeverity) &&
    typeof file === 'string' &&
    file.length > 0 &&
    typeof message === 'string' &&
    message.length > 0
  );
}

function parseFinding(item: unknown): ParsedFinding | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  const severity = obj['severity'];
  const file = obj['file'];
  const message = obj['message'];
  if (!isValidBaseField(severity, file, message)) return null;

  const finding: ParsedFinding = {
    severity: severity as SecuritySeverity,
    file: file as string,
    message: message as string,
  };
  if (typeof obj['line'] === 'number') finding.line = obj['line'];
  if (typeof obj['rule'] === 'string') finding.rule = obj['rule'];
  return finding;
}

export function parseFindingsFromText(text: string): ParsedFinding[] {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(parseFinding).filter((f): f is ParsedFinding => f !== null);
}
