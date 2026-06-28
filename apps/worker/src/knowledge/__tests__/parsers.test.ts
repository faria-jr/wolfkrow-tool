/**
 * Knowledge parsers — md, csv, and parseByMimeType dispatch (pure functions).
 *
 * Covers the non-binary paths (md/text/html/csv + fallback) that don't require
 * the pdf/docx/xlsx native deps. The dynamic imports in parseByMimeType are
 * exercised for real.
 */

import { describe, it, expect } from 'vitest';

import { parseMd, parseCsv, parseByMimeType } from '../parsers/index';

describe('parseMd', () => {
  it('returns the text unchanged and derives a title from the filename', async () => {
    const doc = await parseMd('# Hello world', 'my-cool-note.md');
    expect(doc.text).toBe('# Hello world');
    expect(doc.title).toBe('my cool note');
  });

  it('returns title undefined when no filename is given', async () => {
    const doc = await parseMd('just text');
    expect(doc.text).toBe('just text');
    expect(doc.title).toBeUndefined();
  });
});

describe('parseCsv', () => {
  it('flattens rows into colon-joined key/value lines', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const doc = await parseCsv(csv);
    expect(doc.text).toContain('name: Alice');
    expect(doc.text).toContain('age: 30');
    expect(doc.text).toContain('name: Bob');
    expect(doc.title).toBeUndefined();
  });
});

describe('parseByMimeType — dispatch', () => {
  it('routes text/markdown to parseMd', async () => {
    const doc = await parseByMimeType(Buffer.from('# Hi'), 'text/markdown', 'note.md');
    expect(doc.text).toBe('# Hi');
    expect(doc.title).toBe('note');
  });

  it('routes text/plain to parseMd', async () => {
    const doc = await parseByMimeType(Buffer.from('plain'), 'text/plain', 'readme.txt');
    expect(doc.text).toBe('plain');
  });

  it('routes text/html to parseMd', async () => {
    const doc = await parseByMimeType(Buffer.from('<p>hi</p>'), 'text/html', 'page.html');
    expect(doc.text).toBe('<p>hi</p>');
  });

  it('routes text/csv to parseCsv', async () => {
    const doc = await parseByMimeType(Buffer.from('a,b\n1,2'), 'text/csv', 'data.csv');
    expect(doc.text).toContain('a: 1');
  });

  it('falls back to raw utf-8 for an unknown mime type', async () => {
    const doc = await parseByMimeType(
      Buffer.from('raw-bytes'),
      'application/octet-stream',
      'bin.dat'
    );
    expect(doc.text).toBe('raw-bytes');
    expect(doc.title).toBe('bin.dat');
  });
});
