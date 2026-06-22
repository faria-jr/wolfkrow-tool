import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDb } from '../../db/client';
import { createRepoRegistry, resetRepoRegistry } from '../registry';

describe('createRepoRegistry (FIX-007)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = path.join(os.tmpdir(), `wk-registry-${Date.now()}-${Math.random()}.db`);
    process.env.WOLFKROW_DB_PATH = tmp;
    resetRepoRegistry();
  });

  afterEach(() => {
    resetRepoRegistry();
    closeDb();
    delete process.env.WOLFKROW_DB_PATH;
  });

  it('returns a registry with every expected repo key', () => {
    const r = createRepoRegistry();
    expect(Object.keys(r).sort()).toEqual(
      [
        'agent', 'auditLog', 'authAudit', 'dailySummary', 'enrichSession',
        'globalRule', 'harnessProject', 'harnessRound', 'harnessSprint',
        'knowledgeChunk', 'knowledgeDoc', 'mcpServer', 'mcpToolRegistry',
        'pipelinePhase', 'pipelineProject', 'scheduledTask', 'secret',
        'semanticMemory', 'skill', 'task', 'taskRun', 'tokenUsage', 'user', 'workflowRun',
      ].sort(),
    );
  });

  it('is a singleton — same instance on repeated calls', () => {
    const a = createRepoRegistry();
    const b = createRepoRegistry();
    expect(a).toBe(b);
  });

  it('force=true rebuilds after reset', () => {
    const a = createRepoRegistry();
    resetRepoRegistry();
    const b = createRepoRegistry(true);
    expect(a).not.toBe(b);
  });
});
