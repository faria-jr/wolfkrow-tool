import type { ParsedDocument } from './index';

export async function parseXlsx(buffer: Buffer): Promise<ParsedDocument> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const lines: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    lines.push(`## ${sheetName}\n${csv}`);
  }

  return { text: lines.join('\n\n'), title: undefined };
}
