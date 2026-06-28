import Fastify from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

vi.mock('../../container', () => {
  const existingScan = {
    id: 'scan-1',
    userId: 'u1',
    projectPath: '/p',
    status: 'completed',
    summary: {},
    startedAt: new Date(),
    completedAt: new Date(),
    error: null,
  };
  return {
    getAdapters: vi.fn().mockReturnValue({
      aiFactory: { createFromConfig: vi.fn() },
      secrets: { get: vi.fn().mockResolvedValue(null) },
      securityAuditRunner: {
        run: vi.fn().mockResolvedValue({
          scanId: 'scan-1',
          findings: [],
          summary: {
            total: 0,
            bySeverity: { info: 0, warning: 0, major: 0, critical: 0, blocker: 0 },
            byDimension: {
              secrets: 0,
              auth: 0,
              isolation: 0,
              duplication: 0,
              logic: 0,
              standards: 0,
              owasp: 0,
              general: 0,
            },
          },
        }),
      },
    }),
    getRepos: vi.fn().mockReturnValue({
      securityScan: {
        create: vi.fn().mockReturnValue({ ...existingScan, status: 'pending', completedAt: null }),
        findById: vi
          .fn()
          .mockImplementation((id: string) => (id === 'scan-1' ? existingScan : null)),
        listByUser: vi.fn().mockReturnValue([]),
        update: vi.fn(),
      },
      securityFinding: {
        insertMany: vi.fn(),
        findByScan: vi.fn().mockReturnValue([]),
      },
    }),
  };
});

vi.mock('@wolfkrow/infra', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    SecurityAuditRunner: class {
      run = vi.fn().mockResolvedValue({
        scanId: 'scan-1',
        findings: [],
        summary: {
          total: 0,
          bySeverity: { info: 0, warning: 0, major: 0, critical: 0, blocker: 0 },
          byDimension: {
            secrets: 0,
            auth: 0,
            isolation: 0,
            duplication: 0,
            logic: 0,
            standards: 0,
            owasp: 0,
            general: 0,
          },
        },
      });
    },
  };
});

vi.mock('../../lib/keychain', () => ({
  getProviderApiKey: vi.fn().mockResolvedValue('sk-test'),
}));

vi.mock('../../agent-factory', () => ({
  listAllProviders: vi.fn().mockResolvedValue([
    {
      id: 'anthropic',
      displayName: 'Anthropic',
      protocol: 'anthropic-compat',
      baseUrl: 'https://api.anthropic.com',
      apiKeyAccount: 'anthropic',
      models: ['claude-sonnet-4-6'],
      supportsTools: true,
    },
  ]),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { auditRoutes } from '../audit';

let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  app = Fastify();
  app.decorate('authenticate', async (request: { user?: { userId?: string } }) => {
    request.user = { userId: 'u1' };
  });
  await auditRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('audit routes', () => {
  it('returns 400 when projectPath missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/audit/run', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('runs a scan and returns 0 findings when AI returns []', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/audit/run',
      payload: { projectPath: '/tmp/p' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { scanId: string; status: string; findingCount: number };
    expect(body.scanId).toBe('scan-1');
    expect(body.status).toBe('completed');
    expect(body.findingCount).toBe(0);
  });

  it('returns 404 for unknown scan', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit/scans/unknown/findings' });
    expect(res.statusCode).toBe(404);
  });

  it('returns findings list when scan exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit/scans/scan-1/findings' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { scanId: string; findings: unknown[]; summary: { total: number } };
    expect(body.scanId).toBe('scan-1');
    expect(body.findings).toEqual([]);
    expect(body.summary.total).toBe(0);
  });

  it('returns 404 when accessing scan owned by another user', async () => {
    const otherApp = Fastify();
    otherApp.decorate('authenticate', async (request: { user?: { userId?: string } }) => {
      request.user = { userId: 'attacker' };
    });
    await auditRoutes(otherApp as unknown as AuthFastifyInstance);
    await otherApp.ready();
    const res = await otherApp.inject({ method: 'GET', url: '/audit/scans/scan-1/findings' });
    expect(res.statusCode).toBe(404);
    await otherApp.close();
  });

  it('returns 404 when accessing scan via /scans/:id owned by another user', async () => {
    const otherApp = Fastify();
    otherApp.decorate('authenticate', async (request: { user?: { userId?: string } }) => {
      request.user = { userId: 'attacker' };
    });
    await auditRoutes(otherApp as unknown as AuthFastifyInstance);
    await otherApp.ready();
    const res = await otherApp.inject({ method: 'GET', url: '/audit/scans/scan-1' });
    expect(res.statusCode).toBe(404);
    await otherApp.close();
  });

  it('listScans ignores userId query string and uses authenticated user only', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit/scans?userId=someone-else' });
    expect(res.statusCode).toBe(200);
    // listByUser should be called with authenticated userId 'u1', NOT 'someone-else'
    const { getRepos } = await import('../../container');
    const repos = vi.mocked(getRepos());
    expect(repos.securityScan.listByUser).toHaveBeenCalledWith('u1', undefined);
  });
});

// ---- P1-1: runAudit failed-status branch (500) + provider fallback ----
describe('audit routes — error mapping', () => {
  it('returns 500 when the scan runner throws (use-case yields status "failed")', async () => {
    // The container mock exposes securityAuditRunner.run as a vi.fn; making it
    // reject drives RunAuditUseCase into its catch branch, which returns
    // status: "failed" — exercising the 500 path in runAuditHandler.
    const { getAdapters } = await import('../../container');
    const adapters = vi.mocked(getAdapters());
    const runnerRun = adapters.securityAuditRunner.run as ReturnType<typeof vi.fn>;
    runnerRun.mockRejectedValueOnce(new Error('scanner exploded'));

    const res = await app.inject({
      method: 'POST',
      url: '/audit/run',
      payload: { projectPath: '/tmp/p' },
    });
    expect(res.statusCode).toBe(500);
    const body = res.json() as { error: string; scanId: string };
    expect(body.error).toBe('scanner exploded');
    expect(body.scanId).toBe('scan-1');
  });

  it('throws when no provider config is available (resolveProvider fallback)', async () => {
    // listAllProviders returns [] → getProviderById returns null for both the
    // requested id and the anthropic fallback → throws 'No provider config'.
    const { listAllProviders } = await import('../../agent-factory');
    vi.mocked(listAllProviders).mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'POST',
      url: '/audit/run',
      payload: { projectPath: '/tmp/p' },
    });
    expect(res.statusCode).toBe(500);
  });
});
