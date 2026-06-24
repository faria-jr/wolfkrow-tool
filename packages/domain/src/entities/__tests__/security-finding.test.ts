import { describe, expect, it } from 'vitest';

import {
  SECURITY_DIMENSIONS,
  SECURITY_SEVERITIES,
  SecurityFinding,
  summarizeFindings,
} from '../security-finding';

const baseProps = {
  scanId: 'scan-1',
  severity: 'warning' as const,
  dimension: 'auth' as const,
  file: 'src/auth.ts',
  message: 'Missing auth check',
};

describe('SecurityFinding', () => {
  it('creates with valid props', () => {
    const f = SecurityFinding.create(baseProps);
    expect(f.scanId).toBe('scan-1');
    expect(f.severity).toBe('warning');
    expect(f.dimension).toBe('auth');
    expect(f.file).toBe('src/auth.ts');
    expect(f.message).toBe('Missing auth check');
  });

  it('returns id when provided', () => {
    expect(SecurityFinding.create({ ...baseProps, id: 'f1' }).id).toBe('f1');
  });

  it('returns line, rule, agentId when provided', () => {
    const f = SecurityFinding.create({
      ...baseProps,
      line: 42,
      rule: 'auth-bypass',
      agentId: 'auth-auditor',
    });
    expect(f.line).toBe(42);
    expect(f.rule).toBe('auth-bypass');
    expect(f.agentId).toBe('auth-auditor');
  });

  it('defaults createdAt', () => {
    expect(SecurityFinding.create(baseProps).createdAt).toBeInstanceOf(Date);
  });

  it('toJSON includes createdAt', () => {
    const json = SecurityFinding.create(baseProps).toJSON();
    expect(json.createdAt).toBeInstanceOf(Date);
  });

  it('throws when scanId missing', () => {
    expect(() => SecurityFinding.create({ ...baseProps, scanId: '' })).toThrow(/scanId required/);
  });

  it('throws when file missing', () => {
    expect(() => SecurityFinding.create({ ...baseProps, file: '' })).toThrow(/file required/);
  });

  it('throws when message missing', () => {
    expect(() => SecurityFinding.create({ ...baseProps, message: '' })).toThrow(/message required/);
  });

  it('throws on invalid severity', () => {
    expect(() => SecurityFinding.create({ ...baseProps, severity: 'nope' as never })).toThrow(/invalid severity/);
  });

  it('throws on invalid dimension', () => {
    expect(() => SecurityFinding.create({ ...baseProps, dimension: 'nope' as never })).toThrow(/invalid dimension/);
  });

  it('accepts all documented severities', () => {
    for (const severity of SECURITY_SEVERITIES) {
      const f = SecurityFinding.create({ ...baseProps, severity });
      expect(f.severity).toBe(severity);
    }
  });

  it('accepts all documented dimensions', () => {
    for (const dimension of SECURITY_DIMENSIONS) {
      const f = SecurityFinding.create({ ...baseProps, dimension });
      expect(f.dimension).toBe(dimension);
    }
  });
});

describe('summarizeFindings', () => {
  it('returns zeros for empty input', () => {
    const s = summarizeFindings([]);
    expect(s.total).toBe(0);
    expect(Object.values(s.bySeverity).every((v) => v === 0)).toBe(true);
    expect(Object.values(s.byDimension).every((v) => v === 0)).toBe(true);
  });

  it('counts totals and breakdown', () => {
    const f1 = SecurityFinding.create({ ...baseProps, severity: 'critical', dimension: 'secrets' });
    const f2 = SecurityFinding.create({ ...baseProps, severity: 'warning', dimension: 'auth' });
    const f3 = SecurityFinding.create({ ...baseProps, severity: 'warning', dimension: 'auth' });
    const s = summarizeFindings([f1, f2, f3]);
    expect(s.total).toBe(3);
    expect(s.bySeverity.critical).toBe(1);
    expect(s.bySeverity.warning).toBe(2);
    expect(s.byDimension.secrets).toBe(1);
    expect(s.byDimension.auth).toBe(2);
  });
});