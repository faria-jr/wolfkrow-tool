import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FsArtifactWriter } from '../artifact-writer';

describe('FsArtifactWriter', () => {
  it('writes content to disk and returns a path inside baseDir', async () => {
    const dir = await mkdtemp(join(tmpdir(), `wk-art-${randomUUID()}`));
    try {
      const writer = new FsArtifactWriter(dir);
      const p = await writer.write('proj/phase-discovery', 'hello artifact');
      expect(p.startsWith(dir)).toBe(true);
      expect(await readFile(p, 'utf8')).toBe('hello artifact');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('neutralizes traversal attempts — path stays inside baseDir', async () => {
    const dir = await mkdtemp(join(tmpdir(), `wk-art-${randomUUID()}`));
    try {
      const writer = new FsArtifactWriter(dir);
      const p = await writer.write('../../etc/evil', 'x');
      expect(p.startsWith(dir)).toBe(true);
      expect(p).not.toMatch(/\.\./);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('sanitizes unsafe characters in key segments', async () => {
    const dir = await mkdtemp(join(tmpdir(), `wk-art-${randomUUID()}`));
    try {
      const writer = new FsArtifactWriter(dir);
      const p = await writer.write('proj/phase with spaces', 'body');
      expect(p).toMatch(/phase_with_spaces\.md$/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('honors WOLFKROW_ARTIFACTS_DIR env var (typo fix)', async () => {
    const dir = await mkdtemp(join(tmpdir(), `wk-env-${randomUUID()}`));
    process.env.WOLFKROW_ARTIFACTS_DIR = dir;
    try {
      const writer = new FsArtifactWriter();
      const p = await writer.write('proj/phase', 'body');
      expect(p.startsWith(dir)).toBe(true);
    } finally {
      delete process.env.WOLFKROW_ARTIFACTS_DIR;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
