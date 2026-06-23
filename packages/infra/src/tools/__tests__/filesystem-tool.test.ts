import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FilesystemTool } from '../filesystem-tool';

let tmpDir: string;
const tool = new FilesystemTool();

beforeEach(async () => {
  tmpDir = await fs.mkdtemp('/tmp/wolfkrow-fs-test-');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const ctx = () => ({ userId: 'u1', workDir: tmpDir });

describe('FilesystemTool', () => {
  it('has correct name', () => {
    expect(tool.name).toBe('filesystem');
    expect(tool.inputSchema).toHaveProperty('properties.operation');
  });

  it('reads a file within workDir', async () => {
    await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'hello world');
    const r = await tool.execute({ operation: 'read', path: 'hello.txt' }, ctx());
    expect(r.isError).toBe(false);
    expect(r.output).toContain('hello world');
  });

  it('writes a file within workDir', async () => {
    const r = await tool.execute({ operation: 'write', path: 'out.txt', content: 'data' }, ctx());
    expect(r.isError).toBe(false);
    const content = await fs.readFile(path.join(tmpDir, 'out.txt'), 'utf-8');
    expect(content).toBe('data');
  });

  it('rejects path traversal', async () => {
    const r = await tool.execute({ operation: 'read', path: '../../../etc/passwd' }, ctx());
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/not allowed/i);
  });

  it('rejects absolute path outside workDir', async () => {
    const r = await tool.execute({ operation: 'read', path: '/etc/passwd' }, ctx());
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/not allowed/i);
  });

  it('returns error result when file not found', async () => {
    const r = await tool.execute({ operation: 'read', path: 'nonexistent.txt' }, ctx());
    expect(r.isError).toBe(true);
  });

  it('lists files with glob', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.ts'), 'a');
    await fs.writeFile(path.join(tmpDir, 'b.ts'), 'b');
    const r = await tool.execute({ operation: 'glob', pattern: '*.ts' }, ctx());
    expect(r.isError).toBe(false);
    expect(r.output).toContain('a.ts');
    expect(r.output).toContain('b.ts');
  });
});
