import { vi } from 'vitest';

/**
 * Minimal chainable mock for the Drizzle query builder surface these repos
 * touch (FIX-027 characterization tests). Every terminal — `.run()`, `.all()`,
 * `.get()` — returns `terminalReturn`; every other method returns the chain so
 * arbitrary `select().from().where().orderBy().limit().all()` shapes compile.
 *
 * Intentionally loose typing — this is test scaffolding, not app code.
 */
export interface MockChain {
  run: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  [method: string]: unknown;
}

export function mockDb(terminalReturn: unknown[] = []): {
  db: Record<string, (...args: unknown[]) => MockChain>;
  chain: MockChain;
} {
  const chain: MockChain = {
    run: vi.fn(),
    all: vi.fn(() => terminalReturn as never),
    get: vi.fn(() => (terminalReturn[0] as never) ?? null),
  };

  const proxy = new Proxy(chain, {
    get: (target, prop: string) => {
      if (prop in target) return target[prop];
      // any chained method returns the chain itself
      target[prop] = vi.fn(() => proxy) as never;
      return target[prop];
    },
  });

  const start = vi.fn(() => proxy);
  const db = new Proxy(
    {},
    {
      get: () => start,
    },
  ) as Record<string, (...args: unknown[]) => MockChain>;

  return { db, chain: proxy };
}
