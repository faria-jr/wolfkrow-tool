import { describe, expect, it } from 'vitest';

import { VaultNote, extractWikilinks } from '../vault-note';

const baseProps = {
  path: 'entities/foo.md',
  kind: 'entity' as const,
  title: 'Foo',
  tags: ['a', 'b'],
  body: 'Hello world',
};

describe('VaultNote', () => {
  it('creates with valid props', () => {
    const n = VaultNote.create(baseProps);
    expect(n.path).toBe('entities/foo.md');
    expect(n.kind).toBe('entity');
    expect(n.title).toBe('Foo');
    expect(n.tags).toEqual(['a', 'b']);
    expect(n.body).toBe('Hello world');
  });

  it('returns id when provided', () => {
    const n = VaultNote.create({ ...baseProps, id: 'note-1' });
    expect(n.id).toBe('note-1');
  });

  it('returns undefined id when omitted', () => {
    expect(VaultNote.create(baseProps).id).toBeUndefined();
  });

  it('returns source when provided', () => {
    expect(VaultNote.create({ ...baseProps, source: 'manual' }).source).toBe('manual');
  });

  it('defaults createdAt and updatedAt', () => {
    const n = VaultNote.create(baseProps);
    expect(n.createdAt).toBeInstanceOf(Date);
    expect(n.updatedAt).toBeInstanceOf(Date);
  });

  it('updatedAt defaults to createdAt when not set', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const n = VaultNote.create({ ...baseProps, createdAt: created });
    expect(n.updatedAt).toEqual(created);
  });

  it('returns wikilinks when provided', () => {
    const n = VaultNote.create({ ...baseProps, wikilinks: ['foo', 'bar'] });
    expect(n.wikilinks).toEqual(['foo', 'bar']);
  });

  it('defaults wikilinks to empty array', () => {
    expect(VaultNote.create(baseProps).wikilinks).toEqual([]);
  });

  it('throws when path missing', () => {
    expect(() => VaultNote.create({ ...baseProps, path: '' })).toThrow(/path required/);
  });

  it('throws when title missing', () => {
    expect(() => VaultNote.create({ ...baseProps, title: '' })).toThrow(/title required/);
  });

  it('throws on invalid kind', () => {
    expect(() => VaultNote.create({ ...baseProps, kind: 'unknown' as never })).toThrow(/invalid kind/);
  });

  it('toJSON returns plain object', () => {
    const n = VaultNote.create(baseProps);
    expect(n.toJSON()).toMatchObject({ path: baseProps.path, kind: 'entity', title: 'Foo' });
  });
});

describe('extractWikilinks', () => {
  it('extracts unique wikilinks', () => {
    expect(extractWikilinks('See [[Foo]] and [[Bar]] and [[foo]] again')).toEqual(['foo', 'bar']);
  });

  it('trims whitespace', () => {
    expect(extractWikilinks('[[ spaced ]]')).toEqual(['spaced']);
  });

  it('returns empty array when no wikilinks', () => {
    expect(extractWikilinks('plain text')).toEqual([]);
  });
});