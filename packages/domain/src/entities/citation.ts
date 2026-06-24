import type { KnowledgeChunk } from './knowledge-chunk';

export interface CitationInput {
  index: number;
  chunk: KnowledgeChunk;
  documentFilename?: string | undefined;
}

/**
 * Render a knowledge-base chunk as an inline citation token (e.g. `[1]`)
 * with a human-readable provenance string. Used by the chat UI to show the
 * source of each retrieved chunk without exposing internal IDs verbatim.
 *
 * Format: `[1] documentId[:position]` (or `[1] filename:position` when the
 * caller passes `documentFilename`). Unknown source types fall back to a
 * plain `[index]` token so the UI never crashes on missing metadata.
 */
export function formatCitation(input: CitationInput): string {
  const label = formatCitationLabel(input);
  return `[${input.index}]${label.length > 0 ? ` ${label}` : ''}`;
}

/**
 * Render just the provenance label (no `[index]` prefix). Useful when the
 * caller wants to compose their own citation token.
 */
export function formatCitationLabel(input: CitationInput): string {
  const filename = input.documentFilename;
  const position = input.chunk.position;
  if (filename && filename.length > 0) {
    return position >= 0 ? `${filename}:${position}` : filename;
  }
  const docId = input.chunk.documentId;
  if (!docId) return '';
  return position >= 0 ? `${docId}:${position}` : docId;
}

/**
 * Build a `[index] provenance` token list from an ordered chunk array. The
 * `index` is 1-based and stable across the same input order — the UI uses
 * this to render `[1]`, `[2]`, `[3]` markers inline with the answer and
 * surface the same indices in the sources panel.
 */
export function buildCitationIndex(
  chunks: ReadonlyArray<KnowledgeChunk>,
  filenames?: Map<string, string>,
): string[] {
  return chunks.map((chunk, idx) =>
    formatCitation({
      index: idx + 1,
      chunk,
      documentFilename: filenames?.get(chunk.documentId),
    }),
  );
}
