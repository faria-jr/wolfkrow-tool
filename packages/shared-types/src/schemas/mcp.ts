/**
 * MCP (Model Context Protocol) server schemas
 */

import { z } from 'zod';

import {
  MetadataSchema,
  NonEmptyStringSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const MCPVisibilitySchema = z.enum(['always', 'on-demand', 'background']);

export type MCPVisibility = z.infer<typeof MCPVisibilitySchema>;

/**
 * MCP Server config
 */
export const MCPServerSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema.optional(),
  name: ShortStringSchema,
  description: z.string().max(1000).optional(),
  command: NonEmptyStringSchema,
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  isActive: z.boolean().default(false),
  isBuiltIn: z.boolean().default(false),
  visibility: MCPVisibilitySchema.default('always'),
  healthCheck: z.string().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type MCPServer = z.infer<typeof MCPServerSchema>;

export const CreateMCPServerInputSchema = MCPServerSchema.omit({
  id: true,
  userId: true,
  isBuiltIn: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateMCPServerInput = z.infer<typeof CreateMCPServerInputSchema>;

export const UpdateMCPServerInputSchema = CreateMCPServerInputSchema.partial();

export type UpdateMCPServerInput = z.infer<typeof UpdateMCPServerInputSchema>;

/**
 * MCP Tool (discovered from MCP server)
 */
export const MCPToolSchema = z.object({
  id: UuidSchema,
  mcpServerId: UuidSchema,
  name: ShortStringSchema,
  description: z.string().max(1000).optional(),
  inputSchema: z.record(z.unknown()).optional(),
  lastSynced: TimestampSchema,
});

export type MCPTool = z.infer<typeof MCPToolSchema>;

/**
 * MCP status (runtime)
 */
export const MCPStatusSchema = z.enum(['stopped', 'starting', 'running', 'error', 'restarting']);

export type MCPStatus = z.infer<typeof MCPStatusSchema>;

export const MCPRuntimeStatusSchema = z.object({
  name: ShortStringSchema,
  status: MCPStatusSchema,
  pid: z.number().int().positive().optional(),
  uptime: z.number().int().min(0).optional(),
  toolCount: z.number().int().min(0).default(0),
  lastError: z.string().optional(),
});

export type MCPRuntimeStatus = z.infer<typeof MCPRuntimeStatusSchema>;

/**
 * Create MCP server request body (web POST /api/mcp-servers).
 *
 * Mirrors the handler: `name` and `command` required; `visibility` is NOT
 * accepted (the handler hardcodes `'always'`).
 */
export const CreateMcpServerRequestBodySchema = z.object({
  name: ShortStringSchema,
  description: z.string().max(1000).optional(),
  command: NonEmptyStringSchema,
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  isActive: z.boolean().default(false),
  healthCheck: z.string().optional(),
});

export type CreateMcpServerRequestBody = z.infer<typeof CreateMcpServerRequestBodySchema>;

/**
 * Update MCP server request body (web PATCH /api/mcp-servers/[id]).
 *
 * Only `isActive` and `visibility` are accepted by the handler. `visibility` is
 * kept as a plain string here so the handler can return its existing 422 status
 * with the allowed-values message (rather than a generic 400).
 */
export const UpdateMcpServerRequestBodySchema = z
  .object({
    name: ShortStringSchema.optional(),
    description: z.string().max(1000).optional(),
    command: NonEmptyStringSchema.optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    isActive: z.boolean().optional(),
    healthCheck: z.string().optional(),
    visibility: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export type UpdateMcpServerRequestBody = z.infer<typeof UpdateMcpServerRequestBodySchema>;
