import { ToolResult } from '@wolfkrow/domain';
import type { PermissionResolver } from '@wolfkrow/domain';
import { describe, expect, it, vi } from 'vitest';

import { executeWithPermissionGate } from '../permission-gate';
import type { ToolPermissionEvent } from '../types';

const ctx = (overrides: Parameters<typeof executeWithPermissionGate>[0]) => overrides;

function stubResolver(canUseTool: () => { type: 'allow' } | { type: 'deny'; reason: string } | { type: 'ask'; prompt: string }): PermissionResolver {
  return { canUseTool, resolve: canUseTool } as unknown as PermissionResolver;
}

describe('executeWithPermissionGate', () => {
  const block = { id: 't1', name: 'bash' };
  const input = { command: ['ls'] };

  it('executes directly when no agent/resolver configured', async () => {
    const execute = vi.fn().mockResolvedValue(ToolResult.ok('t1', 'ok'));
    const result = await executeWithPermissionGate(ctx({}), block, input, execute);
    expect(execute).toHaveBeenCalled();
    expect(result.result.isError).toBe(false);
    expect(result.permissionChunk).toBeUndefined();
  });

  it('skips resolver when only agent is set (backward compat)', async () => {
    const execute = vi.fn().mockResolvedValue(ToolResult.ok('t1', 'ok'));
    const result = await executeWithPermissionGate(ctx({ agent: { allowedTools: ['bash'] } }), block, input, execute);
    expect(execute).toHaveBeenCalled();
    expect(result.result.isError).toBe(false);
  });

  it('returns deny result without executing', async () => {
    const execute = vi.fn();
    const resolver = stubResolver(() => ({ type: 'deny', reason: 'forbidden' }));
    const result = await executeWithPermissionGate(ctx({ agent: { allowedTools: [] }, permissionResolver: resolver }), block, input, execute);
    expect(execute).not.toHaveBeenCalled();
    expect(result.result.isError).toBe(true);
    expect(result.result.output).toContain('forbidden');
  });

  it('returns allow result and executes', async () => {
    const execute = vi.fn().mockResolvedValue(ToolResult.ok('t1', 'ran'));
    const resolver = stubResolver(() => ({ type: 'allow' }));
    const result = await executeWithPermissionGate(ctx({ agent: { allowedTools: ['bash'] }, permissionResolver: resolver }), block, input, execute);
    expect(execute).toHaveBeenCalled();
    expect(result.result.output).toBe('ran');
    expect(result.permissionChunk).toBeUndefined();
  });

  it('returns permission chunk on ask and executes when approved', async () => {
    const execute = vi.fn().mockResolvedValue(ToolResult.ok('t1', 'ran'));
    const resolver = stubResolver(() => ({ type: 'ask', prompt: 'allow?' }));
    const requestPermission = vi.fn().mockResolvedValue(true);
    const result = await executeWithPermissionGate(
      ctx({ agent: { allowedTools: ['bash'] }, permissionResolver: resolver, requestPermission }),
      block, input, execute,
    );
    expect(requestPermission).toHaveBeenCalled();
    const event = requestPermission.mock.calls[0]?.[0] as ToolPermissionEvent;
    expect(event.callId).toBe('t1');
    expect(event.name).toBe('bash');
    expect(event.prompt).toBe('allow?');
    expect(execute).toHaveBeenCalled();
    expect(result.permissionChunk?.toolPermission).toEqual(event);
  });

  it('returns not-approved result and skips execute', async () => {
    const execute = vi.fn();
    const resolver = stubResolver(() => ({ type: 'ask', prompt: 'allow?' }));
    const requestPermission = vi.fn().mockResolvedValue(false);
    const result = await executeWithPermissionGate(
      ctx({ agent: { allowedTools: ['bash'] }, permissionResolver: resolver, requestPermission }),
      block, input, execute,
    );
    expect(execute).not.toHaveBeenCalled();
    expect(result.result.isError).toBe(true);
    expect(result.result.output).toContain('not approved');
    expect(result.permissionChunk).toBeDefined();
  });

  it('denies by default when ask has no requestPermission handler', async () => {
    const execute = vi.fn();
    const resolver = stubResolver(() => ({ type: 'ask', prompt: 'allow?' }));
    const result = await executeWithPermissionGate(
      ctx({ agent: { allowedTools: ['bash'] }, permissionResolver: resolver }),
      block, input, execute,
    );
    expect(execute).not.toHaveBeenCalled();
    expect(result.result.isError).toBe(true);
    expect(result.result.output).toContain('not approved');
  });
});