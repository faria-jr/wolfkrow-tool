import { describe, expect, it } from 'vitest';

import { DrizzleMcpServerRepo } from '../mcp-server-repo';

import { mockDb } from './mock-db';

const ROW = {
  id: 's1',
  userId: 'u1',
  name: 'memory',
  description: 'mem',
  command: 'node',
  args: ['a.js'],
  env: { K: 'V' },
  isActive: true,
  isBuiltIn: false,
  visibility: 'always',
  healthCheck: '/health',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('DrizzleMcpServerRepo (FIX-027)', () => {
  it('findById returns null when no rows', () => {
    const { db } = mockDb([]);
    const repo = new DrizzleMcpServerRepo(db as never);
    expect(repo.findById('missing')).toBeNull();
  });

  it('findById maps a row to McpServerRecord', () => {
    const { db } = mockDb([ROW]);
    const repo = new DrizzleMcpServerRepo(db as never);
    const server = repo.findById('s1');
    expect(server?.id).toBe('s1');
    expect(server?.isActive).toBe(true);
    expect(server?.isBuiltIn).toBe(false);
    expect(server?.args).toEqual(['a.js']);
    expect(server?.env).toEqual({ K: 'V' });
  });

  it('findActive maps all rows', () => {
    const { db } = mockDb([ROW]);
    const repo = new DrizzleMcpServerRepo(db as never);
    expect(repo.findActive()).toHaveLength(1);
  });

  it('save persists then re-fetches the record', () => {
    const { db } = mockDb([ROW]);
    const repo = new DrizzleMcpServerRepo(db as never);
    const saved = repo.save('s1', {
      userId: 'u1',
      name: 'memory',
      command: 'node',
      args: [],
      env: {},
      isActive: true,
      isBuiltIn: false,
      visibility: 'always',
    });
    expect(saved.id).toBe('s1');
  });

  it('toggleActive and delete execute without throwing', () => {
    const { db, chain } = mockDb();
    const repo = new DrizzleMcpServerRepo(db as never);
    repo.toggleActive('s1', true);
    repo.delete('s1');
    expect(chain.run).toHaveBeenCalledTimes(2);
  });
});
