import type { ParsedDocument } from './index';

export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const pdfModule = await import('pdf-parse');
  const pdfParse = ('default' in pdfModule ? pdfModule.default : pdfModule) as (b: Buffer) => Promise<{ text: string; info?: Record<string, unknown> }>;
  const result = await pdfParse(buffer);
  return { text: result.text, title: (result.info?.['Title'] as string | undefined) ?? undefined };
}
