/**
 * createLogger — production logger shape, redaction, and dev transport.
 *
 * The module reads env at evaluation time, so each test resets the module
 * cache and re-imports with the desired env.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIG_NODE_ENV = process.env['NODE_ENV'];
const ORIG_LOG_LEVEL = process.env['LOG_LEVEL'];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIG_NODE_ENV === undefined) delete process.env['NODE_ENV'];
  else process.env['NODE_ENV'] = ORIG_NODE_ENV;
  if (ORIG_LOG_LEVEL === undefined) delete process.env['LOG_LEVEL'];
  else process.env['LOG_LEVEL'] = ORIG_LOG_LEVEL;
});

async function importLogger() {
  const mod = (await import('../logger')) as typeof import('../logger');
  return mod.createLogger;
}

describe('createLogger', () => {
  it('builds a production logger with the configured name + service base', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['LOG_LEVEL'];
    const createLogger = await importLogger();
    const log = createLogger('test-prod');
    expect(log.bindings()).toMatchObject({ service: 'wolfkrow-worker', name: 'test-prod' });
  });

  it('respects the LOG_LEVEL env override', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['LOG_LEVEL'] = 'debug';
    const createLogger = await importLogger();
    const log = createLogger('lvl');
    expect(log.level).toBe('debug');
  });

  it('defaults to info level when LOG_LEVEL is unset', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['LOG_LEVEL'];
    const createLogger = await importLogger();
    const log = createLogger('default-lvl');
    expect(log.level).toBe('info');
  });

  it('builds a development logger (pino-pretty transport) without throwing', async () => {
    process.env['NODE_ENV'] = 'development';
    const createLogger = await importLogger();
    // The dev branch wires a pino-pretty transport target; we only assert it
    // constructs and is usable (introspecting the worker transport is brittle).
    const log = createLogger('dev');
    expect(() => log.info('dev-mode-message')).not.toThrow();
  });
});
