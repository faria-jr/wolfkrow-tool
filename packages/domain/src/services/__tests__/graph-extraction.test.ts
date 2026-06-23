import { describe, expect, it } from 'vitest';

import {
  buildEntities,
  computeCooccurrence,
  extractKeyPhrases,
  extractProperNouns,
  extractTechTerms,
  findFirstPosition,
  tokenize,
} from '../graph-extraction';

describe('graph-extraction', () => {
  describe('tokenize', () => {
    it('normalizes and splits text', () => {
      expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
    });

    it('filters empty tokens', () => {
      expect(tokenize('  a   b  ')).toEqual(['a', 'b']);
    });
  });

  describe('findFirstPosition', () => {
    it('returns first token index for multi-word label', () => {
      const tokens = tokenize('The quick brown fox');
      expect(findFirstPosition(tokens, 'brown fox')).toBe(2);
    });

    it('returns -1 when label not found', () => {
      expect(findFirstPosition(['a', 'b'], 'c')).toBe(-1);
    });

    it('returns -1 for empty label', () => {
      expect(findFirstPosition(['a', 'b'], '')).toBe(-1);
    });
  });

  describe('extractProperNouns', () => {
    it('extracts capitalized words', () => {
      expect(extractProperNouns('Alice went to Paris.')).toContain('Alice');
      expect(extractProperNouns('Alice went to Paris.')).toContain('Paris');
    });

    it('ignores stop words and short tokens', () => {
      expect(extractProperNouns('A B c')).toEqual([]);
    });
  });

  describe('extractTechTerms', () => {
    it('finds known acronyms', () => {
      expect(extractTechTerms('Use REST API and JSON.')).toEqual(['REST', 'API', 'JSON']);
    });

    it('deduplicates terms', () => {
      expect(extractTechTerms('API and API')).toEqual(['API']);
    });
  });

  describe('extractKeyPhrases', () => {
    it('returns adjacent token pairs', () => {
      const phrases = extractKeyPhrases('quick brown fox');
      expect(phrases).toContain('quick brown');
      expect(phrases).toContain('brown fox');
    });

    it('limits to 20 phrases', () => {
      const text = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
      expect(extractKeyPhrases(text).length).toBe(20);
    });
  });

  describe('buildEntities', () => {
    it('combines nouns, tech terms and phrases', () => {
      const entities = buildEntities('Use the REST API in Python projects.');
      const labels = entities.map((e) => e.label);
      expect(labels).toContain('REST');
      expect(labels).toContain('API');
      expect(labels.some((l) => l.includes('projects'))).toBe(true);
    });

    it('deduplicates by lowercase label', () => {
      const entities = buildEntities('API and api');
      expect(entities.filter((e) => e.label.toLowerCase() === 'api').length).toBe(1);
    });
  });

  describe('computeCooccurrence', () => {
    it('returns pairs within window', () => {
      const entities = [
        { label: 'A', type: 'entity' as const, position: 0 },
        { label: 'B', type: 'entity' as const, position: 3 },
        { label: 'C', type: 'entity' as const, position: 20 },
      ];
      const pairs = computeCooccurrence(entities, 8);
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toMatchObject({ a: 'A', b: 'B', weight: 1 / 3 });
    });

    it('excludes entities with negative positions', () => {
      const entities = [
        { label: 'A', type: 'entity' as const, position: -1 },
        { label: 'B', type: 'entity' as const, position: 2 },
      ];
      expect(computeCooccurrence(entities)).toHaveLength(0);
    });
  });
});
