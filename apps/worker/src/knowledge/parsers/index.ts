export interface ParsedDocument {
  text: string;
  title: string | undefined;
}

export interface DocParser {
  parse(input: Buffer | string): Promise<ParsedDocument>;
}

export { parsePdf } from './pdf';
export { parseDocx } from './docx';
export { parseCsv } from './csv';
export { parseXlsx } from './xlsx';
export { parseMd } from './md';
export { parseUrl } from './url';

export type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/msword'
  | 'text/csv'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'text/markdown'
  | 'text/plain'
  | 'text/html';

export async function parseByMimeType(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedDocument> {
  const { parsePdf } = await import('./pdf');
  const { parseDocx } = await import('./docx');
  const { parseCsv } = await import('./csv');
  const { parseXlsx } = await import('./xlsx');
  const { parseMd } = await import('./md');

  if (mimeType === 'application/pdf') return parsePdf(buffer);
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword')
    return parseDocx(buffer);
  if (mimeType === 'text/csv') return parseCsv(buffer.toString('utf-8'));
  if (mimeType.includes('spreadsheetml') || mimeType === 'application/vnd.ms-excel')
    return parseXlsx(buffer);
  if (mimeType === 'text/markdown' || mimeType === 'text/plain')
    return parseMd(buffer.toString('utf-8'), filename);
  if (mimeType === 'text/html') return parseMd(buffer.toString('utf-8'), filename);

  return { text: buffer.toString('utf-8'), title: filename };
}
