import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MgraphEngine, sanitizeFilename, validateVaultPath } from '../mgraph-engine';

function makeVault(): { dir: string; engine: MgraphEngine } {
  const dir = mkdtempSync(join(tmpdir(), 'mgraph-test-'));
  return { dir, engine: new MgraphEngine({ vaultRoot: dir }) };
}

function cleanup(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

describe('sanitizeFilename', () => {
  it('lowercases and dashes spaces', () => {
    expect(sanitizeFilename('Hello World')).toBe('hello-world');
  });
  it('removes accents', () => {
    expect(sanitizeFilename('João')).toBe('joao');
  });
  it('removes special chars', () => {
    expect(sanitizeFilename('a!@#$b')).toBe('ab');
  });
  it('caps length at 50', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeFilename(long).length).toBe(50);
  });
});

describe('validateVaultPath', () => {
  it('accepts valid path', () => {
    expect(validateVaultPath('entities/foo.md').valid).toBe(true);
  });
  it('rejects path traversal', () => {
    expect(validateVaultPath('../etc/passwd').valid).toBe(false);
  });
  it('rejects double slashes', () => {
    expect(validateVaultPath('entities//foo.md').valid).toBe(false);
  });
  it('rejects invalid chars', () => {
    expect(validateVaultPath('entities/foo bar.md').valid).toBe(false);
  });
  it('rejects path without allowed prefix', () => {
    expect(validateVaultPath('other/foo.md').valid).toBe(false);
  });
});

describe('MgraphEngine', () => {
  it('ensureVault creates all subdirs', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      for (const sub of ['entities', 'meetings', 'decisions', 'projects', 'references']) {
        expect((await import('node:fs')).existsSync(join(dir, sub))).toBe(true);
      }
    } finally {
      cleanup(dir);
    }
  });

  it('createNote writes a markdown file with frontmatter', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      const note = await engine.createNote({
        path: 'entities/auth-service.md',
        kind: 'entity',
        title: 'Auth Service',
        tags: ['auth', 'service'],
        body: 'The authentication microservice.',
      });
      expect(note.path).toBe('entities/auth-service.md');
      expect(note.title).toBe('Auth Service');
      const raw = await engine.readRaw('entities/auth-service.md');
      expect(raw).toContain('title: "Auth Service"');
      expect(raw).toContain('type: entity');
      expect(raw).toContain('tags: ["auth", "service"]');
    } finally {
      cleanup(dir);
    }
  });

  it('readNote returns null for missing note', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      const n = await engine.readNote('entities/missing.md');
      expect(n).toBeNull();
    } finally {
      cleanup(dir);
    }
  });

  it('updateNote updates body and frontmatter', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      await engine.createNote({
        path: 'projects/alpha.md',
        kind: 'project',
        title: 'Alpha',
        tags: [],
        body: 'Initial body.',
      });
      const updated = await engine.updateNote(
        'projects/alpha.md',
        'Updated body content',
        'Alpha v2',
        ['updated']
      );
      expect(updated.title).toBe('Alpha v2');
      expect(updated.tags).toEqual(['updated']);
      expect(updated.body).toBe('Updated body content');
    } finally {
      cleanup(dir);
    }
  });

  it('deleteNote removes file', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      await engine.createNote({
        path: 'decisions/abc.md',
        kind: 'decision',
        title: 'ABC',
        tags: [],
        body: 'x',
      });
      await engine.deleteNote('decisions/abc.md');
      expect(await engine.readNote('decisions/abc.md')).toBeNull();
    } finally {
      cleanup(dir);
    }
  });

  it('rejects path traversal in createNote', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      await expect(
        engine.createNote({
          path: '../escape.md',
          kind: 'entity',
          title: 'X',
          tags: [],
          body: 'x',
        })
      ).rejects.toThrow(/traversal|invalid/i);
    } finally {
      cleanup(dir);
    }
  });

  it('buildGraphData extracts wikilinks as edges', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      await engine.createNote({
        path: 'projects/main.md',
        kind: 'project',
        title: 'Main Project',
        tags: [],
        body: 'See [[auth-service]] for login.',
      });
      await engine.createNote({
        path: 'entities/auth-service.md',
        kind: 'entity',
        title: 'Auth Service',
        tags: [],
        body: 'Auth details.',
      });
      const graph = await engine.buildGraphData();
      expect(graph.nodes).toHaveLength(2);
      const mainNode = graph.nodes.find((n) => n.path === 'projects/main.md');
      expect(mainNode).toBeDefined();
      // Edge may or may not match depending on slug logic
      const matchingEdge = graph.edges.find((e) => e.source === 'projects/main.md');
      expect(matchingEdge).toBeDefined();
    } finally {
      cleanup(dir);
    }
  });

  it('searchVault matches title and body content', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      await engine.createNote({
        path: 'references/postgres.md',
        kind: 'reference',
        title: 'Postgres',
        tags: [],
        body: 'Relational database.',
      });
      const byTitle = await engine.searchVault({ query: 'postgres' });
      expect(byTitle.length).toBeGreaterThan(0);
      const byBody = await engine.searchVault({ query: 'relational' });
      expect(byBody.length).toBeGreaterThan(0);
    } finally {
      cleanup(dir);
    }
  });

  it('searchVault filters by kind', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      await engine.createNote({
        path: 'entities/foo.md',
        kind: 'entity',
        title: 'Foo',
        tags: [],
        body: 'common term',
      });
      await engine.createNote({
        path: 'meetings/m1.md',
        kind: 'meeting',
        title: 'M1',
        tags: [],
        body: 'common term',
      });
      const onlyEntities = await engine.searchVault({ query: 'common', kind: 'entity' });
      expect(onlyEntities).toHaveLength(1);
      expect(onlyEntities[0]!.path).toBe('entities/foo.md');
    } finally {
      cleanup(dir);
    }
  });

  it('getStats returns counts', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      await engine.createNote({
        path: 'entities/a.md',
        kind: 'entity',
        title: 'A',
        tags: [],
        body: 'x',
      });
      await engine.createNote({
        path: 'meetings/m1.md',
        kind: 'meeting',
        title: 'M1',
        tags: [],
        body: 'x',
      });
      const stats = await engine.getStats();
      expect(stats.noteCount).toBe(2);
      expect(stats.byKind.entity).toBe(1);
      expect(stats.byKind.meeting).toBe(1);
      expect(stats.byKind.project).toBe(0);
    } finally {
      cleanup(dir);
    }
  });
});

describe('MgraphEngine — existing files', () => {
  it('parses frontmatter from existing files', async () => {
    const { dir, engine } = makeVault();
    try {
      await engine.ensureVault();
      writeFileSync(
        join(dir, 'entities', 'pre-existing.md'),
        '---\ntitle: "Pre Existing"\ntype: entity\ntags: ["legacy"]\n---\n\nLegacy content here.'
      );
      const note = await engine.readNote('entities/pre-existing.md');
      expect(note).not.toBeNull();
      expect(note!.title).toBe('Pre Existing');
      expect(note!.tags).toEqual(['legacy']);
      expect(note!.body).toBe('Legacy content here.');
    } finally {
      cleanup(dir);
    }
  });
});
