import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createMcpManager } from '../mcp/manager';

/**
 * FIX-006 / G9 — the built-in MCP servers must actually start and answer the
 * JSON-RPC handshake (`initialize` + `tools/list`). Each server is spawned as a
 * real child process (the same path the McpManager uses in production) and
 * exercised over stdio. `tools/list` is static metadata, so no auth/HTTP is
 * needed here — that only matters for `tools/call` (FIX-017).
 */

const ROOT = join(import.meta.dirname, '../../../../');
const distOf = (name: string): string => join(ROOT, `packages/mcp-servers/${name}/dist/index.js`);

const SERVERS: ReadonlyArray<readonly [name: string, toolCount: number]> = [
  ['graph-search', 2],
  ['wolfkrow-skills', 1],
  ['knowledge-base', 1],
];

// Skip when the dist bundles are not built yet (e.g. `test` ran before `build`
// in the task graph) rather than reporting false negatives.
const allBuilt = SERVERS.every(([name]) => existsSync(distOf(name)));

describe.skipIf(!allBuilt)('built-in MCP servers (FIX-006)', () => {
  it.each(SERVERS)(
    '%s starts and declares its tools via tools/list',
    async (name, toolCount) => {
      const manager = createMcpManager({ rpcTimeoutMs: 5000 });
      try {
        const state = await manager.start({
          name,
          command: 'node',
          args: [distOf(name)],
        });
        expect(state.status).toBe('running');
        expect(manager.listTools(name)).toHaveLength(toolCount);
      } finally {
        await manager.stop(name);
      }
    },
    15000,
  );
});
