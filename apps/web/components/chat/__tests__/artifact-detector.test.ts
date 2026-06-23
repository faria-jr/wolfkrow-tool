import { describe, expect, it } from 'vitest';

import { detectArtifact } from '../artifact-detector';

describe('detectArtifact', () => {
  describe("'excalidraw'", () => {
    it('detects JSON with type excalidraw and elements array', () => {
      const data = JSON.stringify({ type: 'excalidraw', elements: [], appState: {} });
      expect(detectArtifact(data)).toBe('excalidraw');
    });

    it('detects excalidraw with non-empty elements', () => {
      const data = JSON.stringify({
        type: 'excalidraw',
        elements: [{ id: 'el1', type: 'rectangle' }],
        appState: { gridSize: null },
      });
      expect(detectArtifact(data)).toBe('excalidraw');
    });

    it('does not detect as excalidraw when type is not excalidraw', () => {
      const data = JSON.stringify({ type: 'other', elements: [] });
      expect(detectArtifact(data)).not.toBe('excalidraw');
    });

    it('does not detect as excalidraw when elements is missing', () => {
      const data = JSON.stringify({ type: 'excalidraw', appState: {} });
      expect(detectArtifact(data)).not.toBe('excalidraw');
    });

    it('does not detect as excalidraw when elements is not an array', () => {
      const data = JSON.stringify({ type: 'excalidraw', elements: 'not-array' });
      expect(detectArtifact(data)).not.toBe('excalidraw');
    });
  });

  describe("'json'", () => {
    it('detects valid JSON object as json', () => {
      expect(detectArtifact('{"key": "value"}')).toBe('json');
    });

    it('detects valid JSON array as json', () => {
      expect(detectArtifact('[1, 2, 3]')).toBe('json');
    });

    it('detects nested JSON object as json', () => {
      const data = JSON.stringify({ a: 1, b: { c: 2 } });
      expect(detectArtifact(data)).toBe('json');
    });
  });

  describe("'code'", () => {
    it('detects string starting with triple backtick as code', () => {
      expect(detectArtifact('```\nconst x = 1;\n```')).toBe('code');
    });

    it('detects string starting with backtick language hint as code', () => {
      expect(detectArtifact('```typescript\nconst x: number = 1;\n```')).toBe('code');
    });

    it('detects string starting with backtick python as code', () => {
      expect(detectArtifact('```python\ndef hello():\n  pass\n```')).toBe('code');
    });
  });

  describe("'text'", () => {
    it('returns text for plain string', () => {
      expect(detectArtifact('hello world')).toBe('text');
    });

    it('returns text for invalid JSON', () => {
      expect(detectArtifact('{not valid json}')).toBe('text');
    });

    it('returns text for empty string', () => {
      expect(detectArtifact('')).toBe('text');
    });

    it('returns text for number-like string', () => {
      expect(detectArtifact('42')).toBe('text');
    });

    it('returns text for boolean-like string', () => {
      expect(detectArtifact('true')).toBe('text');
    });

    it('returns text for JSON null', () => {
      expect(detectArtifact('null')).toBe('text');
    });
  });
});
