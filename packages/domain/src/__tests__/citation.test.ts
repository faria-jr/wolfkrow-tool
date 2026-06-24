import { describe, expect, it } from 'vitest';

import {
  buildCitationIndex,
  formatCitation,
  formatCitationLabel,
} from '../entities/citation';
import { KnowledgeChunk } from '../entities/knowledge-chunk';

function makeChunk(overrides: Partial<{ id: string; documentId: string; position: number }> = {}): KnowledgeChunk {
  return KnowledgeChunk.fromProps({
    id: overrides.id ?? 'chunk-1',
    documentId: overrides.documentId ?? 'doc-42',
    content: 'lorem ipsum',
    embedding: undefined,
    metadata: { sourceType: 'raw', position: overrides.position ?? 7 },
    position: overrides.position ?? 7,
    createdAt: new Date(0),
  });
}

describe('citation (M4)', () => {
  describe('formatCitation', () => {
    it('renders [index] filename:position when filename is provided', () => {
      const chunk = makeChunk({ documentId: 'doc-1', position: 12 });
      expect(formatCitation({ index: 1, chunk, documentFilename: 'guide.md' })).toBe('[1] guide.md:12');
    });

    it('renders [index] documentId:position when filename is missing', () => {
      const chunk = makeChunk({ documentId: 'doc-1', position: 12 });
      expect(formatCitation({ index: 3, chunk })).toBe('[3] doc-1:12');
    });

    it('omits the position when it is negative', () => {
      const chunk = makeChunk({ documentId: 'doc-1', position: -1 });
      expect(formatCitation({ index: 5, chunk, documentFilename: 'no-pos.md' })).toBe('[5] no-pos.md');
    });

    it('returns a plain [index] token when neither filename nor documentId are available', () => {
      const chunk = makeChunk({ documentId: '', position: -1 });
      expect(formatCitation({ index: 7, chunk })).toBe('[7]');
    });
  });

  describe('formatCitationLabel', () => {
    it('matches the suffix of formatCitation', () => {
      const chunk = makeChunk({ documentId: 'doc-x', position: 42 });
      const labeled = formatCitation({ index: 1, chunk, documentFilename: 'x.md' });
      expect(labeled.endsWith(formatCitationLabel({ index: 1, chunk, documentFilename: 'x.md' }))).toBe(true);
    });

    it('returns empty string for empty documentId without filename', () => {
      const chunk = makeChunk({ documentId: '' });
      expect(formatCitationLabel({ index: 1, chunk })).toBe('');
    });
  });

  describe('buildCitationIndex', () => {
    it('returns one citation per chunk, 1-indexed', () => {
      const chunks = [
        makeChunk({ id: 'a', documentId: 'doc-1', position: 1 }),
        makeChunk({ id: 'b', documentId: 'doc-2', position: 2 }),
        makeChunk({ id: 'c', documentId: 'doc-1', position: 3 }),
      ];
      const filenames = new Map([
        ['doc-1', 'intro.md'],
        ['doc-2', 'advanced.md'],
      ]);
      const lines = buildCitationIndex(chunks, filenames);
      expect(lines).toEqual([
        '[1] intro.md:1',
        '[2] advanced.md:2',
        '[3] intro.md:3',
      ]);
    });

    it('falls back to documentId when filename map is missing entries', () => {
      const chunks = [makeChunk({ id: 'a', documentId: 'known', position: 0 })];
      const filenames = new Map<string, string>();
      expect(buildCitationIndex(chunks, filenames)).toEqual(['[1] known:0']);
    });
  });
});
