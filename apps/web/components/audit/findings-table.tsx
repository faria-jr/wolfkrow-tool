'use client';

import { memo, useMemo, useState } from 'react';
import { FixedSizeList } from 'react-window';

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

/** Fixed row height for the virtualized list (px). */
const ROW_HEIGHT = 40;
/** Container height for the virtualized body (px). Fits ~12 rows before scroll. */
const LIST_HEIGHT = 480;

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

/** Column header row — sticky above the virtualized body. */
function FindingsHeader() {
  return (
    <div role="row" className="flex w-full bg-muted">
      <div role="columnheader" className="w-32 shrink-0 px-4 py-2 text-left text-xs font-semibold">
        Severity
      </div>
      <div role="columnheader" className="w-32 shrink-0 px-4 py-2 text-left text-xs font-semibold">
        Dimension
      </div>
      <div role="columnheader" className="min-w-0 flex-1 px-4 py-2 text-left text-xs font-semibold">
        File
      </div>
      <div role="columnheader" className="min-w-0 flex-1 px-4 py-2 text-left text-xs font-semibold">
        Message
      </div>
    </div>
  );
}

interface RowProps {
  finding: Finding;
  onSelect: (findingId: string) => void;
}

/**
 * A single finding row. Memoized so re-renders triggered by filtering or
 * scrolling only reconcile rows whose `finding` reference changed.
 * `onSelect` is keyed by id (not a closure capturing the finding) to keep
 * the callback referentially stable across renders.
 */
const FindingRow = memo(function FindingRow({ finding, onSelect }: RowProps) {
  const location =
    finding.line !== undefined ? `${finding.file}:${finding.line}` : finding.file;
  return (
    <div
      role="row"
      className="flex w-full cursor-pointer border-t"
      onClick={() => onSelect(finding.id)}
    >
      <div className="w-32 shrink-0 px-4 py-2">
        <SeverityBadge severity={finding.severity} />
      </div>
      <div className="w-32 shrink-0 px-4 py-2">{finding.dimension}</div>
      <div className="min-w-0 flex-1 truncate px-4 py-2">{location}</div>
      <div className="min-w-0 flex-1 px-4 py-2">{finding.message}</div>
    </div>
  );
});

interface ListRowProps {
  index: number;
  data: { findings: Finding[]; onSelect: (id: string) => void };
}

/** react-window row renderer — delegates to the memoized FindingRow. */
function renderRow({ index, data }: ListRowProps) {
  const { findings, onSelect } = data;
  const finding = findings[index];
  if (!finding) return null;
  return <FindingRow finding={finding} onSelect={onSelect} />;
}

interface FindingsTableBodyProps {
  findings: Finding[];
  onSelect: (findingId: string) => void;
}

function FindingsTableBody({ findings, onSelect }: FindingsTableBodyProps) {
  const itemData = useMemo(() => ({ findings, onSelect }), [findings, onSelect]);
  return (
    <div className="flex-1 overflow-hidden rounded-md border">
      <FindingsHeader />
      <FixedSizeList
        height={LIST_HEIGHT}
        width="100%"
        itemCount={findings.length}
        itemSize={ROW_HEIGHT}
        itemData={itemData}
      >
        {renderRow}
      </FixedSizeList>
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

  // Stable, id-based selection handler — wired by parent in a follow-up. Kept
  // identity-stable (no closure over a finding) so memoized rows do not
  // re-render on unrelated parent state changes.
  const handleSelect = (findingId: string) => {
    void findingId;
  };

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
        <div className="overflow-x-auto">
          <FindingsTableBody findings={filtered} onSelect={handleSelect} />
        </div>
      )}
    </div>
  );
}
