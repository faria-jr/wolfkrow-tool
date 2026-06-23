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
    const result = await tool.execute({ command: 'echo hello world' }, ctx);
    expect(result).toBeInstanceOf(ToolResult);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('hello world');
  });

  it('returns error result when command exits non-zero', async () => {
    mockSpawn('', 'command not found', 127);
    const tool = new BashTool();
    const result = await tool.execute({ command: 'badcmd' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('command not found');
  });

  it('rejects sudo commands', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: 'sudo rm -rf /' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toMatch(/sudo/i);
  });

  it('rejects path traversal via cwd', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: 'ls', cwd: '/etc' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.output).toMatch(/not allowed/i);
  });
});
