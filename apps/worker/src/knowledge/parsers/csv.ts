import type { ParsedDocument } from './index';

export async function parseCsv(text: string): Promise<ParsedDocument> {
  const { parse } = await import('csv-parse/sync');
  const records = parse(text, { columns: true, skip_empty_lines: true }) as Record<
    string,
    string
  >[];
  const lines = records.map((r) =>
    Object.entries(r)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
  );
  return { text: lines.join('\n'), title: undefined };
}
