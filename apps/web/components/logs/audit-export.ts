/**
 * - Audit log export helpers.
 *
 * Pure-function formatters that turn the rendered audit entries into CSV or
 * JSON for download. Used by `<AuditLogTable>` export buttons.
 *
 * Why this lives in its own file: both formatters are deterministic and
 * testable in isolation, and the test file needs a stable import path
 * that doesn't depend on the React component tree.
 */

export interface ExportableAuditEntry {
 id: string;
 userId: string;
 action: string;
 resourceType: string;
 resourceId: string | undefined;
 ip: string | undefined;
 /** ISO string. The component may hold a Date and convert in the export step. */
 timestamp: string;
 metadata: Record<string, unknown>;
}

const CSV_COLUMNS: ReadonlyArray<keyof ExportableAuditEntry> = [
 'id',
 'timestamp',
 'userId',
 'action',
 'resourceType',
 'resourceId',
 'ip',
 'metadata',
];

/**
 * Escape a CSV cell per RFC 4180: wrap in double quotes if the cell
 * contains `"`, `,`, or a newline; double any embedded quotes.
 */
function escapeCsvCell(value: unknown): string {
 let s: string;
 if (value === undefined || value === null) {
 s = '';
 } else if (typeof value === 'string') {
 s = value;
 } else {
 // Objects/arrays get JSON-stringified so callers see actual structure
 // instead of `[object Object]`. Numbers and booleans stringify naturally.
 s = JSON.stringify(value);
 }
 if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
 return `"${s.replace(/"/g, '""')}"`;
 }
 return s;
}

export function formatAuditCsv(entries: ReadonlyArray<ExportableAuditEntry>): string {
 const header = CSV_COLUMNS.join(',');
 const rows = entries.map((e) =>
 CSV_COLUMNS.map((col) => escapeCsvCell(e[col])).join(','),
 );
 return [header, ...rows].join('\n');
}

export function formatAuditJson(entries: ReadonlyArray<ExportableAuditEntry>): string {
 return JSON.stringify({ entries, count: entries.length, exportedAt: new Date().toISOString() }, null, 2);
}

/**
 * Trigger a browser download of `content` as a file. Uses an anchor element
 * with a Blob URL so the table never holds the data in memory after the
 * download prompt appears.
 */
export function downloadAuditFile(content: string, filename: string, mime: string): void {
 if (typeof window === 'undefined') return;
 const blob = new Blob([content], { type: mime });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 // Defer revocation so Firefox finishes the download before the URL dies.
 setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Suggested filename for an export - embeds the timestamp + entry count. */
export function buildAuditFilename(extension: 'csv' | 'json', count: number): string {
 const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
 return `wolfkrow-audit-${ts}-${count}entries.${extension}`;
}
