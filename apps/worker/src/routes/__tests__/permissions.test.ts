/**
 * Permissions + Audit routes — happy / error paths.
 *
 * permissions.ts builds ResolvePermission/RecordAuditEntry/QueryAuditLog use-
 * cases at module scope from getRepos().auditLog. Mocking that repo with an
 * in-memory fake exercises the real route logic (resolve, record, query with
 * filters). Routes use getUserId (no auth hook) so req.user is stamped via an
 * onRequest hook mirroring the app-scope auth plugin.
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const { entries, fakeAuditRepo } = vi.hoisted(() => {
  const entries: Array<Record<string, unknown>> = [];
  const fakeAuditRepo = {
    insert: (entry: Record<string, unknown>) => {
      entries.push(entry);
    },
    findMany: (filter: { userId?: string; action?: string; resourceType?: string; since?: Date; limit?: number }) =>
      entries
        .filter((e) => (!filter.userId || e.userId === filter.userId))
        .filter((e) => (!filter.action || e.action === filter.action))
        .filter((e) => (!filter.resourceType || e.resourceType === filter.resourceType))
        .filter((e) => (!filter.since || (e.timestamp as Date) >= filter.since!))
        .slice(0, filter.limit ?? 50)
        .map((e) => ({ ...e, timestamp: e.timestamp instanceof Date ? (e.timestamp as Date).toISOString() : e.timestamp })),
  };
  return { entries, fakeAuditRepo };
});

vi.mock('../../container', () => ({ getRepos: () => ({ auditLog: fakeAuditRepo }) }));

import type { AuthFastifyInstance } from '../../types/fastify';
import { permissionsRoutes } from '../permissions';

import { setErrorHandler } from './helpers/app';

function stampUser(): (req: FastifyRequest, _reply: FastifyReply) => Promise<void> {
  return async (req) => {
    req.user = { userId: 'u1' };
  };
}

let app: FastifyInstance;

beforeAll(async () => {
  entries.length = 0;
  app = Fastify();
  app.addHook('onRequest', stampUser());
  setErrorHandler(app);
  await permissionsRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('permissions POST /resolve', () => {
  it('allows a tool present in the whitelist (type=allow)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/resolve',
      payload: { tool: 'bash', allowedTools: ['bash', 'fs'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { type: string };
    expect(body.type).toBe('allow');
  });

  it('denies a tool absent from the whitelist (type=deny)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/resolve',
      payload: { tool: 'bash', allowedTools: ['fs'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { type: string; reason: string };
    expect(body.type).toBe('deny');
    expect(body.reason).toContain('whitelist');
  });

  it('blacklist takes precedence (deny even when whitelisted)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/resolve',
      payload: { tool: 'bash', allowedTools: ['bash'], blockedTools: ['bash'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { type: string };
    expect(body.type).toBe('deny');
  });

  it('rejects a body missing tool → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/resolve', payload: { allowedTools: ['bash'] } });
    expect(res.statusCode).toBe(400);
  });
});

describe('permissions POST /audit — record', () => {
  it('records an audit entry and returns ok', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/audit',
      payload: { action: 'login', resourceType: 'session', resourceId: 'r1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(entries.some((e) => e.action === 'login')).toBe(true);
  });

  it('records with metadata (covers metadata spread branch)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'export', resourceType: 'vault', metadata: { count: 3 } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a body missing action → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/audit', payload: { resourceType: 'session' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('permissions GET /audit — query', () => {
  it('returns entries filtered by action', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit?action=login&limit=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { entries: { action: string }[] };
    expect(body.entries.every((e) => e.action === 'login')).toBe(true);
  });

  it('applies the default limit when none provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().entries)).toBe(true);
  });

  it('rejects an invalid since datetime → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit?since=not-a-date' });
    expect(res.statusCode).toBe(400);
  });

  it('filters by a valid since datetime + resourceType (covers since branch)', async () => {
    const since = new Date(Date.now() - 60_000).toISOString();
    const res = await app.inject({
      method: 'GET', url: `/audit?since=${encodeURIComponent(since)}&resourceType=vault`,
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().entries)).toBe(true);
  });
});
