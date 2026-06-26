/**
 * Tests: EPIC 1.1 — validateProjectPath (path safety for harness coder cwd).
 */

import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateProjectPath } from '../project-path';

let root: string;
let allowedRoot: string;
let outsideRoot: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'wk-path-'));
  allowedRoot = await mkdtemp(join(tmpdir(), 'wk-allow-'));
  outsideRoot = await mkdtemp(join(tmpdir(), 'wk-out-'));
  process.env['WOLFKROW_ALLOWED_PROJECT_ROOTS'] = allowedRoot;
});

afterEach(async () => {
  delete process.env['WOLFKROW_ALLOWED_PROJECT_ROOTS'];
  await Promise.allSettled([rm(root, { recursive: true, force: true }), rm(allowedRoot, { recursive: true, force: true }), rm(outsideRoot, { recursive: true, force: true })]);
});

describe('validateProjectPath', () => {
  it('rejects a non-absolute path', () => {
    const r = validateProjectPath('relative/dir');
    expect(r.ok).toBe(false);
  });

  it('rejects a path that does not exist', () => {
    const r = validateProjectPath(join(allowedRoot, 'nope-missing'));
    expect(r.ok).toBe(false);
  });

  it('rejects a file (must be a directory)', async () => {
    const file = join(allowedRoot, 'file.txt');
    await writeFile(file, 'x');
    const r = validateProjectPath(file);
    expect(r.ok).toBe(false);
  });

  it('rejects a directory outside the allowlist', () => {
    const r = validateProjectPath(outsideRoot);
    expect(r.ok).toBe(false);
  });

  it('accepts a real directory inside the allowlist', () => {
    const r = validateProjectPath(allowedRoot);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(realpathSync(allowedRoot));
  });

  it('rejects a symlink that escapes the allowlist', async () => {
    const link = join(allowedRoot, 'escape');
    await symlink(outsideRoot, link);
    const r = validateProjectPath(link);
    expect(r.ok).toBe(false);
  });

  it('accepts any existing absolute dir when no allowlist is configured', () => {
    delete process.env['WOLFKROW_ALLOWED_PROJECT_ROOTS'];
    const r = validateProjectPath(root);
    expect(r.ok).toBe(true);
  });
});
