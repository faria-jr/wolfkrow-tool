/**
 * config schema — defaults + the production WORKER_SECRET requirement.
 *
 * config.ts parses at module load, so we reset modules per test to control env.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIG = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  // Restore the original env.
  for (const k of Object.keys(process.env)) if (!(k in ORIG)) delete process.env[k];
  Object.assign(process.env, ORIG);
});

describe('config', () => {
  it('applies defaults in development (port, host, dev worker secret)', async () => {
    delete process.env['NODE_ENV'];
    delete process.env['PORT'];
    delete process.env['WORKER_SECRET'];
    const { config } = await import('../config');
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(4000);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.WORKER_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('coerces PORT from a string env value', async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['PORT'] = '4321';
    const { config } = await import('../config');
    expect(config.PORT).toBe(4321);
  });

  it('requires WORKER_SECRET >= 32 chars and throws in production if absent', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['WORKER_SECRET'];
    await expect(import('../config')).rejects.toThrow(/WORKER_SECRET/i);
  });

  it('accepts an explicit WORKER_SECRET in production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['WORKER_SECRET'] = 'a-very-long-production-secret-value-32+';
    const { config } = await import('../config');
    expect(config.WORKER_SECRET).toBe('a-very-long-production-secret-value-32+');
  });
});
