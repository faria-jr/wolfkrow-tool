import { describe, expect, it } from 'vitest';

import {
  buildAuditFilename,
  formatAuditCsv,
  formatAuditJson,
  type ExportableAuditEntry,
} from '../audit-export';

const sampleEntries: ExportableAuditEntry[] = [
  {
    id: 'entry-1',
    userId: 'user-1',
    action: 'agent.create',
    resourceType: 'agent',
    resourceId: 'agent-abc',
    ip: '127.0.0.1',
    timestamp: '2024-01-15T10:00:00.000Z',
    metadata: { count: 3 },
  },
  {
    id: 'entry-2',
    userId: 'user-2',
    action: 'secret.delete',
    resourceType: 'secret',
    resourceId: undefined,
    ip: undefined,
    timestamp: '2024-01-15T11:00:00.000Z',
    metadata: {},
  },
];

describe('audit-export (M6.4)', () => {
  describe('formatAuditCsv', () => {
    it('includes the header row and one row per entry', () => {
      const csv = formatAuditCsv(sampleEntries);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('id,timestamp,userId,action,resourceType,resourceId,ip,metadata');
    });

    it('joins row columns with commas in the correct order', () => {
      const csv = formatAuditCsv([sampleEntries[0]!]);
      const row = csv.split('\n')[1]!;
      // metadata is JSON-stringified and then CSV-escaped: {"count":3} becomes "{""count"":3}"
      expect(row).toBe(
        'entry-1,2024-01-15T10:00:00.000Z,user-1,agent.create,agent,agent-abc,127.0.0.1,"{""count"":3}"',
      );
    });

    it('emits empty cells for undefined fields (e.g. resourceId, ip)', () => {
      const csv = formatAuditCsv([sampleEntries[1]!]);
      const row = csv.split('\n')[1]!;
      // entry-2,...,user-2,secret.delete,secret,,,
      expect(row).toBe('entry-2,2024-01-15T11:00:00.000Z,user-2,secret.delete,secret,,,{}');
    });

    it('escapes cells containing commas, quotes, or newlines per RFC 4180', () => {
      const tricky: ExportableAuditEntry = {
        id: 'e1',
        userId: 'a,b"c',
        action: 'x\ny',
        resourceType: 'r',
        resourceId: 'has "quote"',
        ip: '1.2.3.4',
        timestamp: '2024-01-01T00:00:00.000Z',
        metadata: {},
      };
      const csv = formatAuditCsv([tricky]);
      // The tricky entry has a literal newline in the action field. Since
      // the action is the 4th column, the row splits on the FIRST newline
      // only — so we need to search across the whole CSV, not just the
      // first line. We also need to re-escape the embedded quote inside
      // the cell back to a single quote for the comparison.
      expect(csv).toContain('"a,b""c"');
      expect(csv).toContain('"x\ny"');
      expect(csv).toContain('"has ""quote"""');
    });
  });

  describe('formatAuditJson', () => {
    it('returns a pretty JSON document with entries + count + exportedAt', () => {
      const json = formatAuditJson(sampleEntries);
      const parsed = JSON.parse(json) as { entries: ExportableAuditEntry[]; count: number; exportedAt: string };
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.count).toBe(2);
      expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('buildAuditFilename', () => {
    it('produces a timestamped filename with the entry count', () => {
      const csvName = buildAuditFilename('csv', 42);
      expect(csvName).toMatch(/^wolfkrow-audit-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-42entries\.csv$/);
      const jsonName = buildAuditFilename('json', 0);
      expect(jsonName).toMatch(/0entries\.json$/);
    });
  });
});
