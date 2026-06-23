import { describe, expect, it } from 'vitest';

import { PermissionResolver, ToolCall, ToolResult } from '../index';

describe('ToolCall', () => {
  it('creates with valid id, name and input', () => {
    const tc = ToolCall.create('call_123', 'bash', { command: 'ls' });
    expect(tc.id).toBe('call_123');
    expect(tc.name).toBe('bash');
    expect(tc.input).toEqual({ command: 'ls' });
  });

  it('rejects empty id', () => {
    expect(() => ToolCall.create('', 'bash', {})).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => ToolCall.create('id1', '', {})).toThrow();
  });

  it('accepts empty input object', () => {
    const tc = ToolCall.create('id1', 'Read', {});
    expect(tc.input).toEqual({});
  });
});

describe('ToolResult', () => {
  it('ok() creates success result', () => {
    const r = ToolResult.ok('call_123', 'hello');
    expect(r.callId).toBe('call_123');
    expect(r.output).toBe('hello');
    expect(r.isError).toBe(false);
  });

  it('error() creates error result', () => {
    const r = ToolResult.error('call_123', 'command not found');
    expect(r.callId).toBe('call_123');
    expect(r.output).toBe('command not found');
    expect(r.isError).toBe(true);
  });

  it('rejects empty callId', () => {
    expect(() => ToolResult.ok('', 'output')).toThrow();
  });
});

describe('PermissionResolver.canUseTool', () => {
  const resolver = new PermissionResolver();
  const agent = { allowedTools: [], blockedTools: [] };

  it('safe tool → allow', () => {
    const r = resolver.canUseTool(agent, 'Read');
    expect(r.type).toBe('allow');
  });

  it('destructive tool → ask', () => {
    const r = resolver.canUseTool(agent, 'Bash:rm');
    expect(r.type).toBe('ask');
  });

  it('unknown tool with no whitelist → deny', () => {
    const r = resolver.canUseTool(agent, 'unknown_tool');
    expect(r.type).toBe('deny');
  });

  it('blocked tool → deny', () => {
    const r = resolver.canUseTool({ allowedTools: [], blockedTools: ['Read'] }, 'Read');
    expect(r.type).toBe('deny');
  });

  it('whitelisted tool → allow', () => {
    const r = resolver.canUseTool({ allowedTools: ['custom_tool'] }, 'custom_tool');
    expect(r.type).toBe('allow');
  });

  it('non-whitelisted tool when whitelist defined → deny', () => {
    const r = resolver.canUseTool({ allowedTools: ['Read'] }, 'Write');
    expect(r.type).toBe('deny');
  });
});
