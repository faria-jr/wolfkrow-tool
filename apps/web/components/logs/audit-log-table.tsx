'use client';

import { useEffect, useState } from 'react';

import {
  buildAuditFilename,
  downloadAuditFile,
  formatAuditCsv,
  formatAuditJson,
  type ExportableAuditEntry,
} from './audit-export';

const AUDIT_ACTIONS = [
  'agent.create', 'agent.update', 'agent.delete', 'agent.sync',
  'skill.create', 'skill.update', 'skill.delete',
  'mcp.start', 'mcp.stop', 'mcp.restart',
  'secret.create', 'secret.update', 'secret.delete', 'secret.access',
  'pipeline.create', 'pipeline.start', 'pipeline.pause', 'pipeline.resume', 'pipeline.complete', 'pipeline.cancel',
  'harness.create', 'harness.start', 'harness.pause', 'harness.complete',
  'knowledge.ingest', 'knowledge.delete',
  'memory.compact', 'session.archive', 'session.delete',
] as const;

interface AuditEntry extends Omit<ExportableAuditEntry, 'timestamp'> {
  timestamp: string | Date;
}

const fmtTs = (ts: string | Date) => (typeof ts === 'string' ? new Date(ts) : ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
const truncate = (s: string | undefined, max = 20) => !s ? '—' : s.length > max ? s.slice(0, max) + '…' : s;

function buildUrl(action: string, resourceType: string, since: string): string {
  const p = new URLSearchParams();
  if (action) p.set('action', action);
  if (resourceType) p.set('resourceType', resourceType);
  if (since) p.set('since', since);
  const qs = p.toString();
  return `/api/permissions/audit${qs ? '?' + qs : ''}`;
}

function defaultSince(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

interface FiltersProps { action: string; resourceType: string; since: string; onAction(v: string): void; onResourceType(v: string): void; onSince(v: string): void; }

function AuditFilters({ action, resourceType, since, onAction, onResourceType, onSince }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="rounded border px-2 py-1 text-sm" value={action} onChange={(e) => onAction(e.target.value)} aria-label="Filter by action">
        <option value="">All actions</option>
        {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <input type="text" className="rounded border px-2 py-1 text-sm" placeholder="Resource type…" value={resourceType} onChange={(e) => onResourceType(e.target.value)} />
      <label className="flex items-center gap-1 text-sm text-muted-foreground">
        Since
        <input type="date" className="rounded border px-2 py-1 text-sm" value={since} onChange={(e) => onSince(e.target.value)} />
      </label>
    </div>
  );
}

interface ExportButtonsProps {
  entries: AuditEntry[];
  /** Disable when no rows are visible (still allow on empty filter results). */
  disabled: boolean;
}

function normalizeForExport(entries: ReadonlyArray<AuditEntry>): ExportableAuditEntry[] {
  return entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    action: e.action,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    ip: e.ip,
    timestamp: typeof e.timestamp === 'string' ? e.timestamp : e.timestamp.toISOString(),
    metadata: e.metadata,
  }));
}

function ExportButtons({ entries, disabled }: ExportButtonsProps) {
  const handleCsv = () => {
    const csv = formatAuditCsv(normalizeForExport(entries));
    downloadAuditFile(csv, buildAuditFilename('csv', entries.length), 'text/csv;charset=utf-8');
  };
  const handleJson = () => {
    const json = formatAuditJson(normalizeForExport(entries));
    downloadAuditFile(json, buildAuditFilename('json', entries.length), 'application/json');
  };
  return (
    <div className="flex items-center gap-2" data-testid="audit-export">
      <button
        type="button"
        onClick={handleCsv}
        disabled={disabled}
        className="rounded border px-2 py-1 text-sm hover:bg-muted disabled:opacity-50"
        aria-label="Export audit log as CSV"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={handleJson}
        disabled={disabled}
        className="rounded border px-2 py-1 text-sm hover:bg-muted disabled:opacity-50"
        aria-label="Export audit log as JSON"
      >
        Export JSON
      </button>
    </div>
  );
}

function AuditTableBody({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Timestamp</th>
            <th className="px-3 py-2 text-left font-medium">Action</th>
            <th className="px-3 py-2 text-left font-medium">Resource Type</th>
            <th className="px-3 py-2 text-left font-medium">Resource ID</th>
            <th className="px-3 py-2 text-left font-medium">IP</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{fmtTs(e.timestamp)}</td>
              <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{e.action}</span></td>
              <td className="px-3 py-2">{e.resourceType}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground" title={e.resourceId}>{truncate(e.resourceId)}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{e.ip ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditLogTable() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [since, setSince] = useState(defaultSince);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(buildUrl(actionFilter, resourceTypeFilter, since))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<{ entries: AuditEntry[] }>; })
      .then((d) => { if (!cancelled) { setEntries(d.entries ?? []); setLoading(false); } })
      .catch((err: unknown) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to fetch'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [actionFilter, resourceTypeFilter, since]);

  if (loading) return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading audit log entries…</div>;
  if (error) return <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">Error: {error}</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AuditFilters action={actionFilter} resourceType={resourceTypeFilter} since={since} onAction={setActionFilter} onResourceType={setResourceTypeFilter} onSince={setSince} />
        <ExportButtons entries={entries ?? []} disabled={(entries ?? []).length === 0} />
      </div>
      {entries && entries.length === 0
        ? <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">No audit log entries found.</div>
        : <AuditTableBody entries={entries ?? []} />}
    </div>
  );
}
