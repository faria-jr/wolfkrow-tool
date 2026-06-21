import type { ParsedDocument } from './index';

export async function parseMd(text: string, filename = ''): Promise<ParsedDocument> {
  const raw = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  return { text, title: raw || undefined };
}
