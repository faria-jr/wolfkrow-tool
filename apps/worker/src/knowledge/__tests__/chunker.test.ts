/**
 * semanticChunk + rawChunk — pure-function coverage.
 *
 * Exercises heading-based splitting, chunk-type resolution (code/list/paragraph),
 * maxSize accumulation, and the empty-input early return.
 */

import { describe, it, expect } from 'vitest';

import { semanticChunk, rawChunk } from '../chunker';

describe('semanticChunk', () => {
  it('returns [] for empty / whitespace-only input', () => {
    expect(semanticChunk('')).toEqual([]);
    expect(semanticChunk('   \n\n  ')).toEqual([]);
  });

  it('chunks by markdown headings, tagging each with the active heading', () => {
    const md = [
      '# Intro',
      'First paragraph under intro.',
      '## Details',
      'Second paragraph under details.',
    ].join('\n\n');
    const chunks = semanticChunk(md);
    expect(chunks.length).toBe(2);
    expect(chunks[0]!.metadata.heading).toBe('Intro');
    expect(chunks[0]!.content).toContain('First paragraph');
    expect(chunks[1]!.metadata.heading).toBe('Details');
    expect(chunks[1]!.content).toContain('Second paragraph');
  });

  it('records sourceType=code for a code block under its own heading', () => {
    const md = ['# Snippet', '', '```ts', 'const x = 1;', '```'].join('\n');
    const chunks = semanticChunk(md);
    const codeChunk = chunks.find((c) => c.metadata.sourceType === 'code');
    expect(codeChunk).toBeDefined();
    expect(codeChunk!.content).toContain('const x = 1');
  });

  it('records sourceType=list for a list under its own heading', () => {
    const md = ['# Items', '', '- one', '- two'].join('\n');
    const chunks = semanticChunk(md);
    const listChunk = chunks.find((c) => c.metadata.sourceType === 'list');
    expect(listChunk).toBeDefined();
    expect(listChunk!.content).toContain('one');
  });

  it('flushes accumulated content when a new heading starts', () => {
    const md = ['# A', 'text-a', '# B', 'text-b'].join('\n\n');
    const chunks = semanticChunk(md);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.metadata.heading).toBe('A');
    expect(chunks[1]!.metadata.heading).toBe('B');
  });

  it('assigns sequential positions starting at 0', () => {
    const md = ['# A', 'x', '# B', 'y', '# C', 'z'].join('\n\n');
    const chunks = semanticChunk(md);
    expect(chunks.map((c) => c.metadata.position)).toEqual([0, 1, 2]);
  });
});

describe('rawChunk', () => {
  it('returns [] for empty input', () => {
    expect(rawChunk('')).toEqual([]);
    expect(rawChunk('   ')).toEqual([]);
  });

  it('splits text into fixed-size chunks tagged sourceType=raw', () => {
    const big = 'a'.repeat(250);
    const chunks = rawChunk(big, 100);
    expect(chunks.length).toBe(3); // 100 + 100 + 50
    for (const c of chunks) expect(c.metadata.sourceType).toBe('raw');
    expect(chunks.map((c) => c.metadata.position)).toEqual([0, 1, 2]);
  });

  it('returns a single chunk when text fits within maxSize', () => {
    const chunks = rawChunk('short', 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe('short');
  });
});
