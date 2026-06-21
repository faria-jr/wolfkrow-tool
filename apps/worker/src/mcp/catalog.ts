/**
 * MCP catalog
 *
 * Loads built-in MCP server definitions from infra.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUILT_IN_MCP_SERVERS } from '@wolfkrow/infra';

import type { McpServerConfig } from './manager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface McpCatalogEntry extends McpServerConfig {
  visibility: 'always' | 'on-demand';
}

export function loadBuiltInMcpCatalog(): McpCatalogEntry[] {
  const rootDir = path.resolve(__dirname, '../../../../packages');

  return BUILT_IN_MCP_SERVERS.map((server) => ({
    name: server.name,
    command: server.command,
    args: server.args.map((arg) =>
      arg.startsWith('../') ? path.resolve(rootDir, arg.replace('../', '')) : arg
    ),
    visibility: server.visibility,
  }));
}
