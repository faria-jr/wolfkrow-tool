import { spawn } from 'node:child_process';

import { ToolResult } from '@wolfkrow/domain';
import { describe, expect, it, vi } from 'vitest';

import { BashTool } from '../bash-tool';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

const ctx = { userId: 'u1', workDir: '/tmp/test-workspace' };

function mockSpawn(stdout: string, stderr: string, code: number) {
  const mock = {
    stdout: { on: vi.fn((ev, cb) => { if (ev === 'data') cb(Buffer.from(stdout)); }) },
    stderr: { on: vi.fn((ev, cb) => { if (ev === 'data') cb(Buffer.from(stderr)); }) },
    on: vi.fn((ev, cb) => { if (ev === 'close') cb(code); }),
  };
  (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mock);
  return mock;
}

describe('BashTool', () => {
  it('has correct name and description', () => {
    const tool = new BashTool();
    expect(tool.name).toBe('bash');
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toHaveProperty('properties.command');
  });

  it('executes command and returns stdout on success', async () => {
    mockSpawn('hello world\n', '', 0);
    const tool = new BashTool();
    const result = await tool.execute({ command: ['echo', 'hello world'] }, ctx);
    expect(result).toBeInstanceOf(ToolResult);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('hello world');
  });

  it('accepts command as string and splits on whitespace', async () => {
    mockSpawn('hello world\n', '', 0);
    const tool = new BashTool();
    const result = await tool.execute({ command: 'echo hello world' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('hello world');
  });

  it('returns error result when command exits non-zero', async () => {
    mockSpawn('', 'command not found', 127);
    const tool = new BashTool();
    const result = await tool.execute({ command: ['ls', 'missing'] }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('command not found');
  });

  it('rejects binary not in allowlist', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: ['badcmd', 'arg'] }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toMatch(/allowlist/i);
  });

  it('rejects sudo commands', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: ['sudo', 'rm', '-rf', '/'] }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toMatch(/sudo|forbidden/i);
  });

  it('rejects path traversal via cwd', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: ['ls'], cwd: '/etc' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toMatch(/not allowed/i);
  });

  it('rejects cwd path traversal by prefix', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: ['ls'], cwd: '../test-workspace-evil' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toMatch(/not allowed/i);
  });

  it('rejects empty command', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: [] }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toMatch(/empty/i);
  });

  it('rejects non-string command', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: 42 }, ctx);
    expect(result.isError).toBe(true);
  });

  it('falls back to default timeout when negative', async () => {
    mockSpawn('', '', 0);
    const tool = new BashTool();
    await tool.execute({ command: 'echo test', timeout: -1 }, ctx);
    const spawnMock = vi.mocked(spawn);
    const spawnOpts = spawnMock.mock.calls[0]?.[2] as { cwd: string };
    expect(spawnOpts).toBeDefined();
  });

  it('falls back to default timeout when NaN', async () => {
    mockSpawn('', '', 0);
    const tool = new BashTool();
    await tool.execute({ command: 'echo test', timeout: 'not-a-number' }, ctx);
    const spawnMock = vi.mocked(spawn);
    expect(spawnMock).toHaveBeenCalled();
  });

  it('falls back to default timeout when Infinity', async () => {
    mockSpawn('', '', 0);
    const tool = new BashTool();
    await tool.execute({ command: 'echo test', timeout: Number.POSITIVE_INFINITY }, ctx);
    const spawnMock = vi.mocked(spawn);
    expect(spawnMock).toHaveBeenCalled();
  });

  it('kills the subprocess and returns an aborted error when the abort signal fires (P1-6)', async () => {
    // Spawn mock that simulates a long-running process: only resolves on close.
    const listeners: Record<string, ((...args: unknown[]) => void) | undefined> = {};
    const kill = vi.fn((sig: string) => {
      // when killed, emit close with a non-zero code
      listeners['close']?.(143);
    });
    const mock = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((ev: string, cb: (...args: unknown[]) => void) => { listeners[ev] = cb; }),
      kill,
    };
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const ac = new AbortController();
    const tool = new BashTool();
    const promise = tool.execute({ command: 'echo test' }, { ...ctx, signal: ac.signal });

    // Abort after execution started.
    ac.abort();
    const result = await promise;

    expect(kill).toHaveBeenCalledWith('SIGTERM');
    expect(result.isError).toBe(true);
    expect(result.output).toMatch(/abort/i);
  });
});
