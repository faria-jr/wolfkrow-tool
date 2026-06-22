import { describe, expect, it } from 'vitest';

import { DrizzleMcpToolRegistryRepo } from '../mcp-tool-registry-repo';

import { mockDb } from './mock-db';

describe('DrizzleMcpToolRegistryRepo (FIX-027)', () => {
  it('upsertMany inserts when no existing tool matches by name', () => {
    const { db, chain } = mockDb([]); // existing lookup returns []
    const repo = new DrizzleMcpToolRegistryRepo(db as never);

    repo.upsertMany('srv-1', [{ name: 'search', description: 'q' }]);

    // insert path: run called once per tool
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('upsertMany updates when an existing tool matches by name', () => {
    const existing = [{ id: 't1', mcpServerId: 'srv-1', name: 'search', description: null, inputSchema: null, lastSynced: new Date() }];
    const { db, chain } = mockDb(existing);
    const repo = new DrizzleMcpToolRegistryRepo(db as never);

    repo.upsertMany('srv-1', [{ name: 'search', description: 'new' }]);

    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('findByServerId maps rows to McpToolRecord', () => {
    const rows = [{ id: 't1', mcpServerId: 'srv-1', name: 'search', description: 'q', inputSchema: { x: 1 }, lastSynced: new Date(0) }];
    const { db } = mockDb(rows);
    const repo = new DrizzleMcpToolRegistryRepo(db as never);

    const tools = repo.findByServerId('srv-1');
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('search');
    expect(tools[0]?.inputSchema).toEqual({ x: 1 });
    expect(tools[0]?.description).toBe('q');
  });

  it('deleteByServerId runs a delete', () => {
    const { db, chain } = mockDb();
    const repo = new DrizzleMcpToolRegistryRepo(db as never);

    repo.deleteByServerId('srv-1');
    expect(chain.run).toHaveBeenCalledTimes(1);
  });
});
