'use client';

import { useMemo, useState } from 'react';

import { SeverityBadge } from './severity-badge';

import { Input } from '@/components/ui/input';

export interface Finding {
  id: string;
  scanId: string;
  severity: string;
  dimension: string;
  file: string;
  line?: number;
  message: string;
  rule?: string;
  agentId?: string;
}

interface FindingsTableProps {
  findings: Finding[];
}

interface Filters {
  severity: string;
  dimension: string;
  fileQuery: string;
}

/**
 * Stable severity ordering for the filter dropdown (worst first) so the
 * Select is readable regardless of the order severities appear in the data.
 */
const SEVERITY_ORDER = ['blocker', 'critical', 'major', 'warning', 'info'];

function useDistinctOptions(findings: Finding[]) {
  const severities = useMemo(
    () =>
      Array.from(new Set(findings.map((f) => f.severity))).sort(
        (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
      ),
    [findings],
  );
  const dimensions = useMemo(
    () => Array.from(new Set(findings.map((f) => f.dimension))).sort(),
    [findings],
  );
  return { severities, dimensions };
}

function FindingsFilterBar({
  filters,
  setFilters,
  severities,
  dimensions,
}: {
  filters: Filters;
  setFilters(next: Partial<Filters>): void;
  severities: string[];
  dimensions: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded border px-2 py-1 text-sm"
        value={filters.severity}
        onChange={(e) => setFilters({ severity: e.target.value })}
        aria-label="Filter by severity"
      >
        <option value="">All severities</option>
        {severities.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className="rounded border px-2 py-1 text-sm"
        value={filters.dimension}
        onChange={(e) => setFilters({ dimension: e.target.value })}
        aria-label="Filter by dimension"
      >
        <option value="">All dimensions</option>
        {dimensions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <Input
        className="h-8 w-48"
        placeholder="Filter by file…"
        value={filters.fileQuery}
        onChange={(e) => setFilters({ fileQuery: e.target.value })}
      />
    </div>
  );
}

function FindingsTableBody({ findings }: { findings: Finding[] }) {
  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left">Severity</th>
            <th className="px-4 py-2 text-left">Dimension</th>
            <th className="px-4 py-2 text-left">File</th>
            <th className="px-4 py-2 text-left">Message</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.id} className="border-t">
              <td className="px-4 py-2">
                <SeverityBadge severity={f.severity} />
              </td>
              <td className="px-4 py-2">{f.dimension}</td>
              <td className="px-4 py-2">
                {f.file}
                {f.line !== undefined ? `:${f.line}` : ''}
              </td>
              <td className="px-4 py-2">{f.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FindingsTable({ findings }: FindingsTableProps) {
  const [filters, setFiltersState] = useState<Filters>({ severity: '', dimension: '', fileQuery: '' });
  const setFilters = (next: Partial<Filters>) => setFiltersState((prev) => ({ ...prev, ...next }));
  const { severities, dimensions } = useDistinctOptions(findings);

  const filtered = useMemo(() => {
    const q = filters.fileQuery.trim().toLowerCase();
    return findings.filter((f) => {
      if (filters.severity && f.severity !== filters.severity) return false;
      if (filters.dimension && f.dimension !== filters.dimension) return false;
      if (q && !f.file.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [findings, filters]);

  if (findings.length === 0) return <p className="text-muted-foreground">No findings.</p>;

  return (
    <div className="space-y-4">
      <FindingsFilterBar
        filters={filters}
        setFilters={setFilters}
        severities={severities}
        dimensions={dimensions}
      />
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No findings match the current filters.</p>
      ) : (
        <FindingsTableBody findings={filtered} />
      )}
    </div>
  );
}
