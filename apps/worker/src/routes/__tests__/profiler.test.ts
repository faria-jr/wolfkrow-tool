import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Fastify from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

vi.mock('../../container', () => ({
  getRepos: vi.fn().mockReturnValue({}),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { profilerRoutes } from '../profiler';

let app: ReturnType<typeof Fastify>;
let testDir: string;

beforeAll(async () => {
  testDir = join(tmpdir(), `profiler-route-test-${Date.now()}`);
  mkdirSync(join(testDir, 'src'), { recursive: true });
  writeFileSync(
    join(testDir, 'package.json'),
    JSON.stringify({ name: 'test', dependencies: { fastify: '*' } })
  );
  writeFileSync(join(testDir, 'src', 'index.ts'), 'export {}');

  app = Fastify();
  app.decorate('authenticate', async () => undefined);
  await profilerRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(testDir, { recursive: true, force: true });
});

describe('POST /profiler', () => {
  it('returns profile with languages, frameworks, fileCount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/profiler',
      payload: { dir: testDir },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { languages: string[]; frameworks: string[]; fileCount: number };
    expect(body.languages).toContain('typescript');
    expect(body.frameworks).toContain('fastify');
    expect(body.fileCount).toBeGreaterThan(0);
  });

  it('returns 400 when dir is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/profiler', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
