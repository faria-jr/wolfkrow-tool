import { describe, expect, it } from 'vitest';

import { CHANNEL_CATALOG } from '../channels';

describe('channel catalog (EPIC 4.1)', () => {
  it('lists all four supported channel types', () => {
    const types = CHANNEL_CATALOG.map((c) => c.type);
    expect(types).toEqual(['telegram', 'discord', 'slack', 'whatsapp']);
  });

  it('marks Telegram available and the rest as coming soon', () => {
    const telegram = CHANNEL_CATALOG.find((c) => c.type === 'telegram');
    expect(telegram?.status).toBe('available');
    for (const c of CHANNEL_CATALOG) {
      if (c.type !== 'telegram') expect(c.status).toBe('coming_soon');
    }
  });
});
