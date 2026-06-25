import { describe, expect, it } from 'vitest';

import { AuditActionSchema, AuditLogSchema } from '../schemas/audit';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('audit schemas', () => {
  describe('AuditActionSchema', () => {
    it('accepts a known action', () => {
      expect(AuditActionSchema.parse('agent.create')).toBe('agent.create');
      expect(AuditActionSchema.parse('session.delete')).toBe('session.delete');
    });
    it('rejects an unknown action', () => {
      expect(() => AuditActionSchema.parse('agent.unknown')).toThrow();
    });
  });

  describe('AuditLogSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      action: 'agent.create' as const,
      resourceType: 'agent',
      metadata: {},
      timestamp: ts,
    };

    it('accepts a valid audit log', () => {
      expect(AuditLogSchema.parse(valid)).toEqual({
        ...valid,
        timestamp: new Date(ts),
      });
    });

    it('accepts optional resourceId / ip / userAgent', () => {
      const withOpts = {
        ...valid,
        resourceId: uuid,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      };
      expect(() => AuditLogSchema.parse(withOpts)).not.toThrow();
    });

    it('rejects missing resourceType', () => {
      const { resourceType: _omit, ...rest } = valid;
      expect(() => AuditLogSchema.parse(rest)).toThrow();
    });

    it('rejects empty resourceType', () => {
      expect(() => AuditLogSchema.parse({ ...valid, resourceType: '' })).toThrow();
    });

    it('rejects invalid action', () => {
      expect(() => AuditLogSchema.parse({ ...valid, action: 'nope' })).toThrow();
    });

    it('rejects non-uuid id', () => {
      expect(() => AuditLogSchema.parse({ ...valid, id: 'x' })).toThrow();
    });
  });
});
