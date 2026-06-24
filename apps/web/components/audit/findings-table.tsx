import type { SecuritySeverity } from '@wolfkrow/domain';

import { SeverityBadge } from './severity-badge';

export interface Finding {
  id: string;
  scanId: string;
  severity: SecuritySeverity;
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

export function FindingsTable({ findings }: FindingsTableProps) {
  if (findings.length === 0) return <p className="text-muted-foreground">No findings.</p>;

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
              <td className="px-4 py-2"><SeverityBadge severity={f.severity} /></td>
              <td className="px-4 py-2">{f.dimension}</td>
              <td className="px-4 py-2">{f.file}{f.line !== undefined ? `:${f.line}` : ''}</td>
              <td className="px-4 py-2">{f.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
