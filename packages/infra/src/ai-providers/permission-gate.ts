/**
 * Permission gate shared between ClaudeAgentProvider and ClaudeCompatProvider.
 * Both providers need the same flow: ask resolver, emit permission chunk,
 * await user approval (or default deny), then execute tool.
 */

import type { AgentPermissions, PermissionResolver } from '@wolfkrow/domain';
import { ToolResult } from '@wolfkrow/domain';

import type { StreamChunk, ToolPermissionEvent } from './types';

export interface PermissionGateDeps {
  agent?: AgentPermissions;
  permissionResolver?: PermissionResolver;
  requestPermission?: (event: ToolPermissionEvent) => Promise<boolean>;
}

export interface PermissionGateResult {
  result: ToolResult;
  permissionChunk?: StreamChunk;
}

export async function executeWithPermissionGate(
  deps: PermissionGateDeps,
  block: { id: string; name: string },
  input: Record<string, unknown>,
  execute: () => Promise<ToolResult>
): Promise<PermissionGateResult> {
  if (!deps.agent || !deps.permissionResolver) {
    return { result: await execute() };
  }
  const decision = deps.permissionResolver.canUseTool(deps.agent, block.name, input);
  if (decision.type === 'deny') {
    return { result: ToolResult.error(block.id, decision.reason) };
  }
  let permissionChunk: StreamChunk | undefined;
  if (decision.type === 'ask') {
    const event: ToolPermissionEvent = {
      callId: block.id,
      name: block.name,
      input,
      prompt: decision.prompt,
    };
    permissionChunk = { delta: '', toolPermission: event };
    const approved = deps.requestPermission ? await deps.requestPermission(event) : false;
    if (!approved) {
      return {
        result: ToolResult.error(block.id, `Tool "${block.name}" not approved by user`),
        permissionChunk,
      };
    }
  }
  return { result: await execute(), ...(permissionChunk ? { permissionChunk } : {}) };
}
