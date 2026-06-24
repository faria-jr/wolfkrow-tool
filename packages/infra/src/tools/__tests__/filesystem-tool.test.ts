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

  it('writes creates nested directories', async () => {
    const r = await tool.execute({ operation: 'write', path: 'sub/dir/nested.txt', content: 'data' }, ctx());
    expect(r.isError).toBe(false);
    const content = await fs.readFile(path.join(tmpDir, 'sub/dir/nested.txt'), 'utf-8');
    expect(content).toBe('data');
  });

  it('glob matches files recursively with ** pattern', async () => {
    await fs.mkdir(path.join(tmpDir, 'sub'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'sub', 'deep.txt'), 'd');
    const r = await tool.execute({ operation: 'glob', pattern: '**/*.txt' }, ctx());
    expect(r.isError).toBe(false);
    expect(r.output).toContain('deep.txt');
  });

  it('glob returns empty when no matches', async () => {
    const r = await tool.execute({ operation: 'glob', pattern: '*.missing' }, ctx());
    expect(r.isError).toBe(false);
    expect(r.output).toBe('');
  });

  it('grep finds matching lines with file:line format', async () => {
    await fs.writeFile(path.join(tmpDir, 'log.txt'), 'error: foo\nwarn: bar\nerror: baz\n');
    const r = await tool.execute({ operation: 'grep', pattern: 'error', searchPath: '.' }, ctx());
    expect(r.isError).toBe(false);
    expect(r.output).toContain('error: foo');
    expect(r.output).toContain('error: baz');
    expect(r.output).not.toContain('warn: bar');
  });

  it('grep returns "(no matches)" when nothing matches', async () => {
    await fs.writeFile(path.join(tmpDir, 'log.txt'), 'hello\n');
    const r = await tool.execute({ operation: 'grep', pattern: 'nothere', searchPath: '.' }, ctx());
    expect(r.isError).toBe(false);
    expect(r.output).toBe('(no matches)');
  });

  it('grep rejects path traversal in searchPath', async () => {
    const r = await tool.execute({ operation: 'grep', pattern: 'foo', searchPath: '../../etc' }, ctx());
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/not allowed/i);
  });

  it('returns error for unknown operation', async () => {
    const r = await tool.execute({ operation: 'delete', path: 'foo' }, ctx());
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/unknown operation/i);
  });

  it('returns error when read path is missing', async () => {
    const r = await tool.execute({ operation: 'read' }, ctx());
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/path is required/i);
  });

  it('falls back to process.cwd() when workDir not provided', async () => {
    const r = await tool.execute({ operation: 'glob', pattern: '*' }, { userId: 'u1' });
    expect(r.isError).toBe(false);
  });
});
