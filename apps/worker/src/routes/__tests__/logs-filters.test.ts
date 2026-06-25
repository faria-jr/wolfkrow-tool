/**
 * Logs routes — history/stream filter branches (level + module).
 *
 * The base auth + happy paths live in logs.test.ts. This file covers the
 * query-param filter branches (lines 36-37, 56-57) that drop entries not
 * matching the requested level/module.
 */

import Fastify from 'fastify';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { logBus } from '../../log/bus';
import type { AuthFastifyInstance } from '../../types/fastify';
import { logsRoutes } from '../logs';

import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };

async function buildApp() {
  const app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await logsRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
  return app;
}

describe('logs GET /history — level + module filters', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    logBus.publish({ level: 'info', time: Date.now(), msg: 'alpha', module: 'mod-a' });
    logBus.publish({ level: 'warn', time: Date.now(), msg: 'beta', module: 'mod-b' });
    logBus.publish({ level: 'error', time: Date.now(), msg: 'gamma', module: 'mod-a' });
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('filters by level', async () => {
    const res = await app.inject({ method: 'GET', url: '/history?level=warn', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const entries = (res.json() as { entries: { level: string }[] }).entries;
    expect(entries.every((e) => e.level === 'warn')).toBe(true);
    expect(entries.some((e) => e.level === 'warn')).toBe(true);
  });

  it('filters by module (substring match on lowercased entry module)', async () => {
    // The route lowercases the entry module before includes(); the query is
    // matched as-is, so use a lowercase substring.
    const res = await app.inject({ method: 'GET', url: '/history?module=mod-a', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const entries = (res.json() as { entries: { module: string }[] }).entries;
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.module === 'mod-a')).toBe(true);
  });

  it('combines level + module filters', async () => {
    const res = await app.inject({ method: 'GET', url: '/history?level=error&module=mod-a', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const entries = (res.json() as { entries: { level: string; module: string }[] }).entries;
    expect(entries.every((e) => e.level === 'error' && e.module === 'mod-a')).toBe(true);
  });

  it('rejects an invalid level enum → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/history?level=bogus', headers: BEARER });
    expect(res.statusCode).toBe(400);
  });
});
