import { describe, expect, it } from 'vitest';

import {
  CreateMCPServerInputSchema,
  CreateMcpServerRequestBodySchema,
  MCPRuntimeStatusSchema,
  MCPStatusSchema,
  MCPServerSchema,
  MCPToolSchema,
  MCPVisibilitySchema,
  UpdateMCPServerInputSchema,
  UpdateMcpServerRequestBodySchema,
} from '../schemas/mcp';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('mcp schemas', () => {
  describe('MCPVisibilitySchema', () => {
    it.each(['always', 'on-demand', 'background'] as const)('accepts %s', (v) => {
      expect(MCPVisibilitySchema.parse(v)).toBe(v);
    });
    it('rejects invalid', () => {
      expect(() => MCPVisibilitySchema.parse('nope')).toThrow();
    });
  });

  describe('MCPStatusSchema', () => {
    it.each(['stopped', 'starting', 'running', 'error', 'restarting'] as const)(
      'accepts %s',
      (v) => {
        expect(MCPStatusSchema.parse(v)).toBe(v);
      }
    );
    it('rejects invalid', () => {
      expect(() => MCPStatusSchema.parse('nope')).toThrow();
    });
  });

  describe('MCPServerSchema', () => {
    const valid = {
      id: uuid,
      name: 'my-server',
      command: 'npx',
      metadata: {},
      createdAt: ts,
      updatedAt: ts,
    };
    it('accepts a valid server and applies defaults', () => {
      const parsed = MCPServerSchema.parse(valid);
      expect(parsed.args).toEqual([]);
      expect(parsed.env).toEqual({});
      expect(parsed.isActive).toBe(false);
      expect(parsed.isBuiltIn).toBe(false);
      expect(parsed.visibility).toBe('always');
    });
    it('accepts optional userId', () => {
      expect(() => MCPServerSchema.parse({ ...valid, userId: uuid })).not.toThrow();
    });
    it('rejects missing command', () => {
      const { command: _omit, ...rest } = valid;
      expect(() => MCPServerSchema.parse(rest)).toThrow();
    });
    it('rejects empty command', () => {
      expect(() => MCPServerSchema.parse({ ...valid, command: '' })).toThrow();
    });
    it('rejects missing name', () => {
      const { name: _omit, ...rest } = valid;
      expect(() => MCPServerSchema.parse(rest)).toThrow();
    });
  });

  describe('CreateMCPServerInputSchema', () => {
    it('accepts the input subset and applies defaults', () => {
      const parsed = CreateMCPServerInputSchema.parse({
        name: 'srv',
        command: 'npx',
      });
      expect(parsed.args).toEqual([]);
    });
    it('rejects missing name', () => {
      expect(() => CreateMCPServerInputSchema.parse({ command: 'npx' })).toThrow();
    });
  });

  describe('UpdateMCPServerInputSchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(UpdateMCPServerInputSchema.parse({})).toEqual({});
    });
    it('rejects bad visibility when provided', () => {
      expect(() => UpdateMCPServerInputSchema.parse({ visibility: 'nope' })).toThrow();
    });
  });

  describe('MCPToolSchema', () => {
    const valid = {
      id: uuid,
      mcpServerId: uuid,
      name: 'tool',
      lastSynced: ts,
    };
    it('accepts a valid tool', () => {
      expect(() => MCPToolSchema.parse(valid)).not.toThrow();
    });
    it('accepts optional inputSchema', () => {
      expect(() =>
        MCPToolSchema.parse({ ...valid, inputSchema: { type: 'object' } })
      ).not.toThrow();
    });
    it('rejects missing name', () => {
      const { name: _omit, ...rest } = valid;
      expect(() => MCPToolSchema.parse(rest)).toThrow();
    });
  });

  describe('MCPRuntimeStatusSchema', () => {
    const valid = { name: 'srv', status: 'running' as const };
    it('accepts valid status and applies default toolCount', () => {
      expect(MCPRuntimeStatusSchema.parse(valid).toolCount).toBe(0);
    });
    it('accepts optional pid / uptime / lastError', () => {
      expect(() =>
        MCPRuntimeStatusSchema.parse({
          ...valid,
          pid: 1234,
          uptime: 60,
          lastError: 'err',
        })
      ).not.toThrow();
    });
    it('rejects invalid status', () => {
      expect(() => MCPRuntimeStatusSchema.parse({ ...valid, status: 'nope' })).toThrow();
    });
  });

  describe('CreateMcpServerRequestBodySchema', () => {
    it('accepts a valid body and applies defaults', () => {
      const parsed = CreateMcpServerRequestBodySchema.parse({
        name: 'srv',
        command: 'npx',
      });
      expect(parsed.args).toEqual([]);
      expect(parsed.env).toEqual({});
      expect(parsed.isActive).toBe(false);
    });
    it('rejects missing name', () => {
      expect(() => CreateMcpServerRequestBodySchema.parse({ command: 'npx' })).toThrow();
    });
  });

  describe('UpdateMcpServerRequestBodySchema (refine)', () => {
    it('accepts when isActive is provided', () => {
      expect(() => UpdateMcpServerRequestBodySchema.parse({ isActive: true })).not.toThrow();
    });
    it('accepts when visibility is provided', () => {
      expect(() => UpdateMcpServerRequestBodySchema.parse({ visibility: 'always' })).not.toThrow();
    });
    it('accepts editable custom server fields', () => {
      const parsed = UpdateMcpServerRequestBodySchema.parse({
        name: 'filesystem',
        description: 'Local files',
        command: 'npx',
        args: ['-y', 'server'],
        env: { ROOT: '/tmp' },
        healthCheck: 'tools/list',
      });
      expect(parsed).toMatchObject({ name: 'filesystem', command: 'npx' });
    });
    it('rejects an empty object (refine: at least one field)', () => {
      expect(() => UpdateMcpServerRequestBodySchema.parse({})).toThrow();
    });
  });
});
