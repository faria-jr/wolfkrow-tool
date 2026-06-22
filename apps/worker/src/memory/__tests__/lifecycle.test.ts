import { afterEach, describe, expect, it, vi } from 'vitest';

const spies = vi.hoisted(() => ({
  saveMemory: vi.fn(),
  saveSummary: vi.fn(),
  embed: vi.fn(),
}));

vi.mock('../../container', () => ({
  getRepos: () => ({
    semanticMemory: { save: spies.saveMemory },
    dailySummary: { save: spies.saveSummary },
  }),
  getAdapters: () => ({ embedder: { embed: spies.embed } }),
}));

import type { Logger } from '../../logger';
import { recordChatTurn, stopMemoryLifecycle } from '../lifecycle';

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as Logger;

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('memory lifecycle (FIX-012 + FIX-013)', () => {
  afterEach(() => {
    stopMemoryLifecycle();
    vi.clearAllMocks();
    spies.saveMemory.mockResolvedValue(undefined);
    spies.embed.mockResolvedValue([1, 2, 3]);
  });

  it('extracts and persists memorable facts from the turn (fire-and-forget)', async () => {
    spies.embed.mockResolvedValue([1, 2, 3]);
    spies.saveMemory.mockResolvedValue(undefined);

    recordChatTurn(logger, 'u1', [
      { role: 'user', content: 'I prefer dark mode for my editor setup.' },
    ]);
    await flush();

    expect(spies.embed).toHaveBeenCalled();
    expect(spies.saveMemory).toHaveBeenCalledTimes(1);
  });

  it('persists nothing when the turn has no memorable statement', async () => {
    recordChatTurn(logger, 'u1', [{ role: 'user', content: 'hi' }]);
    await flush();

    expect(spies.saveMemory).not.toHaveBeenCalled();
  });

  it('never throws — extraction failures are logged, not propagated', async () => {
    spies.saveMemory.mockRejectedValueOnce(new Error('db down'));

    recordChatTurn(logger, 'u1', [
      { role: 'user', content: 'I prefer dark mode always, really.' },
    ]);
    await flush();
    await flush();

    expect(logger.error).toHaveBeenCalled();
  });
});
