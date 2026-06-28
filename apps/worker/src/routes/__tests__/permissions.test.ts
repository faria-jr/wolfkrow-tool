/**
 * Permissions + Audit routes — happy / error paths + auth/decisions coverage.
 *
 * permissions.ts builds ResolvePermission/RecordAuditEntry/QueryAuditLog use-
 * cases at module scope from getRepos().auditLog. Mocking that repo with an
 * in-memory fake exercises the real route logic (resolve, record, query with
 * filters).
 *
 * Every route is guarded by `onRequest: [server.authenticate]` (P2-1 security
 * fix). The happy/error-path suite decorates `authenticate` as an authed
 * stub (req.user pre-populated). A separate suite uses the REAL-behaving
 * async authenticate decorator (Bearer-checking, mirrors plugins/auth.ts) to
 * prove the 401-without-credential case is a genuine rejection — and that
 * removing the preHandler makes that test fail (mutation check).
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const { entries, fakeAuditRepo, fakeToolPermission, decisionStore } = vi.hoisted(() => {
  const entries: Array<Record<string, unknown>> = [];
  const fakeAuditRepo = {
    insert: (entry: Record<string, unknown>) => {
      entries.push(entry);
    },
    findMany: (filter: {
      userId?: string;
      action?: string;
      resourceType?: string;
      since?: Date;
      limit?: number;
    }) =>
      entries
        .filter((e) => !filter.userId || e.userId === filter.userId)
        .filter((e) => !filter.action || e.action === filter.action)
        .filter((e) => !filter.resourceType || e.resourceType === filter.resourceType)
        .filter((e) => !filter.since || (e.timestamp as Date) >= filter.since!)
        .slice(0, filter.limit ?? 50)
        .map((e) => ({
          ...e,
          timestamp:
            e.timestamp instanceof Date ? (e.timestamp as Date).toISOString() : e.timestamp,
        })),
  };

  // Per-user in-memory decision store: userId -> array of { agentId, tool, decision }.
  // Lets the PUT/DELETE + cross-user isolation tests assert real state changes
  // without touching the DB.
  const decisionStore = new Map<
    string,
    Array<{ agentId: string; tool: string; decision: string }>
  >();
  const fakeToolPermission = {
    listForUser: (userId: string, agentId?: string) => {
      const rows = (decisionStore.get(userId) ?? []).filter(
        (r) => !agentId || r.agentId === agentId
      );
      return rows.map((r) => ({ userId, ...r }));
    },
  };

  return { entries, fakeAuditRepo, fakeToolPermission, decisionStore };
});

vi.mock('../../container', () => ({
  getRepos: () => ({ auditLog: fakeAuditRepo, toolPermission: fakeToolPermission }),
}));

// Mock the permission-store so PUT/DELETE hit the in-memory decisionStore,
// keeping the test hermetic (no DB) while exercising the real route wiring.
vi.mock('../../chat/permission-store', () => ({
  recordDecision: (userId: string, agentId: string, tool: string, decision: string) => {
    const rows = decisionStore.get(userId) ?? [];
    const idx = rows.findIndex((r) => r.agentId === agentId && r.tool === tool);
    if (idx >= 0) rows[idx] = { agentId, tool, decision };
    else rows.push({ agentId, tool, decision });
    decisionStore.set(userId, rows);
  },
  clearDecision: (userId: string, agentId: string, tool: string) => {
    const rows = (decisionStore.get(userId) ?? []).filter(
      (r) => !(r.agentId === agentId && r.tool === tool)
    );
    decisionStore.set(userId, rows);
  },
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { permissionsRoutes } from '../permissions';

import { buildAppWithRealAuth, setErrorHandler } from './helpers/app';

/** Authed decorator: populates req.user so happy-path routes see a real user. */
function authedStub(): (req: FastifyRequest, _reply: FastifyReply) => Promise<void> {
  return async (req) => {
    req.user = { userId: 'u1' };
  };
}

let app: FastifyInstance;

beforeAll(async () => {
  entries.length = 0;
  decisionStore.clear();
  app = Fastify();
  // Provide the authenticate decorator the routes now require (P2-1). Using
  // the authed stub here keeps the existing happy/error-path suite green;
  // the 401 case is covered by the real-auth suite below.
  app.decorate('authenticate', authedStub());
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
    const res = await app.inject({
      method: 'POST',
      url: '/resolve',
      payload: { allowedTools: ['bash'] },
    });
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
      method: 'POST',
      url: '/audit',
      payload: { action: 'export', resourceType: 'vault', metadata: { count: 3 } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a body missing action → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/audit',
      payload: { resourceType: 'session' },
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
      method: 'GET',
      url: `/audit?since=${encodeURIComponent(since)}&resourceType=vault`,
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().entries)).toBe(true);
  });
});

/**
 * Authentication + decision-management coverage (P2-1 security fix).
 *
 * Uses a REAL-behaving async authenticate decorator (Bearer-checking, mirrors
 * plugins/auth.ts) so the 401-without-credential case is a genuine rejection,
 * not a skipped assertion. The cross-user isolation test uses a multi-user
 * decorator that derives req.user.userId from the Bearer token value.
 */

/** Bearer header value that satisfies realAuthenticate (expects 'Bearer ...'). */
const BEARER = { authorization: 'Bearer test-token' };

describe('permissions routes — authentication required', () => {
  let authedApp: FastifyInstance;

  beforeAll(async () => {
    decisionStore.clear();
    authedApp = await buildAppWithRealAuth((server) => permissionsRoutes(server));
  });
  afterAll(async () => {
    await authedApp.close();
  });

  it('GET /decisions without credentials → 401', async () => {
    const res = await authedApp.inject({ method: 'GET', url: '/decisions' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /resolve without credentials → 401 (whole prefix is protected)', async () => {
    const res = await authedApp.inject({
      method: 'POST',
      url: '/resolve',
      payload: { tool: 'bash', allowedTools: ['bash'] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /decisions with credentials → 200 (returns the authed user decisions)', async () => {
    // Seed a decision for u1 (the userId realAuthenticate stamps).
    decisionStore.set('u1', [{ agentId: 'coder', tool: 'bash', decision: 'allow' }]);
    const res = await authedApp.inject({
      method: 'GET',
      url: '/decisions',
      headers: BEARER,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { decisions: { agentId: string; tool: string; decision: string }[] };
    expect(body.decisions.some((d) => d.tool === 'bash' && d.decision === 'allow')).toBe(true);
  });

  it('PUT /decisions upserts a decision (assert state change + response)', async () => {
    decisionStore.clear();
    const res = await authedApp.inject({
      method: 'PUT',
      url: '/decisions',
      headers: BEARER,
      payload: { agentId: 'coder', tool: 'fs', decision: 'deny' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    // State actually changed in the (mocked) store.
    expect(
      (decisionStore.get('u1') ?? []).some((r) => r.tool === 'fs' && r.decision === 'deny')
    ).toBe(true);
  });

  it('DELETE /decisions removes a stored decision (assert state change)', async () => {
    decisionStore.set('u1', [{ agentId: 'coder', tool: 'rm', decision: 'deny' }]);
    const res = await authedApp.inject({
      method: 'DELETE',
      url: '/decisions',
      headers: BEARER,
      payload: { agentId: 'coder', tool: 'rm' },
    });
    expect(res.statusCode).toBe(200);
    expect((decisionStore.get('u1') ?? []).some((r) => r.tool === 'rm')).toBe(false);
  });
});

/**
 * Mutation-check proof: the only thing producing a 401 above is the route
 * actually invoking `server.authenticate`. The real-auth decorator rejects
 * on its own, but if the route did NOT declare `onRequest: [authenticate]`,
 * the handler would run and the request would NOT reach the decorator's
 * reject path via the route hook — confirmed by temporarily stripping the
 * `auth` options from the routes: the 401 tests then fail (return 200).
 */

describe('permissions /decisions — cross-user isolation', () => {
  // Multi-user decorator: userId is derived from the Bearer token value so
  // user A and user B get distinct identities in the same app.
  const multiUserAuth = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }
    const token = authHeader.slice('Bearer '.length);
    req.user = { userId: token };
  };

  let multiApp: FastifyInstance;

  beforeAll(async () => {
    decisionStore.clear();
    multiApp = Fastify();
    multiApp.decorate('authenticate', multiUserAuth);
    setErrorHandler(multiApp);
    await permissionsRoutes(multiApp as unknown as AuthFastifyInstance);
    await multiApp.ready();
  });
  afterAll(async () => {
    await multiApp.close();
  });

  it("user A's decision is NOT visible to user B", async () => {
    // User A records a decision.
    const putA = await multiApp.inject({
      method: 'PUT',
      url: '/decisions',
      headers: { authorization: 'Bearer userA' },
      payload: { agentId: 'coder', tool: 'secret-tool', decision: 'allow' },
    });
    expect(putA.statusCode).toBe(200);

    // User A sees it.
    const getA = await multiApp.inject({
      method: 'GET',
      url: '/decisions',
      headers: { authorization: 'Bearer userA' },
    });
    expect(getA.statusCode).toBe(200);
    const aBody = getA.json() as { decisions: { tool: string }[] };
    expect(aBody.decisions.some((d) => d.tool === 'secret-tool')).toBe(true);

    // User B does NOT see user A's decision.
    const getB = await multiApp.inject({
      method: 'GET',
      url: '/decisions',
      headers: { authorization: 'Bearer userB' },
    });
    expect(getB.statusCode).toBe(200);
    const bBody = getB.json() as { decisions: { tool: string }[] };
    expect(bBody.decisions.some((d) => d.tool === 'secret-tool')).toBe(false);
  });
});
