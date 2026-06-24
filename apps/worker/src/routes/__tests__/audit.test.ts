import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';
import Fastify from 'fastify';

vi.mock('../../container', () => {
  const existingScan = { id: 'scan-1', userId: 'u1', projectPath: '/p', status: 'completed', summary: {}, startedAt: new Date(), completedAt: new Date(), error: null };
  return {
    getAdapters: vi.fn().mockReturnValue({
      aiFactory: { createFromConfig: vi.fn() },
      secrets: { get: vi.fn().mockResolvedValue(null) },
    }),
    getRepos: vi.fn().mockReturnValue({
      securityScan: {
        create: vi.fn().mockReturnValue({ ...existingScan, status: 'pending', completedAt: null }),
        findById: vi.fn().mockImplementation((id: string) => id === 'scan-1' ? existingScan : null),
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
  const actual = await importOriginal<typeof import('@wolfkrow/infra')>();
  return {
    ...actual,
    SecurityAuditRunner: class {
      run = vi.fn().mockResolvedValue({
        scanId: 'scan-1',
        findings: [],
        summary: { total: 0, bySeverity: { info: 0, warning: 0, major: 0, critical: 0, blocker: 0 }, byDimension: { secrets: 0, auth: 0, isolation: 0, duplication: 0, logic: 0, standards: 0, owasp: 0, general: 0 } },
      });
    },
  };
});

vi.mock('../../lib/keychain', () => ({
  getProviderApiKey: vi.fn().mockResolvedValue('sk-test'),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { auditRoutes } from '../audit';

let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  app = Fastify();
  app.decorate('authenticate', async () => undefined);
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
});
