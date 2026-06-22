import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock TelegramBot (hoisted so vi.mock factory can reference it) ─────────────
const { mockBot, handlers, textHandlers } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const textHandlers: Array<[RegExp, (...args: unknown[]) => unknown]> = [];
  const mockBot = {
    on: vi.fn((event: string, cb: (...args: unknown[]) => unknown) => {
      handlers[event] = cb;
    }),
    onText: vi.fn((re: RegExp, cb: (...args: unknown[]) => unknown) => {
      textHandlers.push([re, cb]);
    }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    stopPolling: vi.fn().mockResolvedValue(undefined),
  };
  return { mockBot, handlers, textHandlers };
});

vi.mock('node-telegram-bot-api', () => ({
  default: vi.fn().mockReturnValue(mockBot),
}));

import { TelegramBridge, type TelegramChatAdapter } from '../telegram/bridge';

function fireText(text: string, fromId = '123') {
  const msg = { chat: { id: 99 }, from: { id: Number(fromId) }, text };
  for (const [re, cb] of textHandlers) {
    const m = text.match(re);
    if (m) void cb(msg, m);
  }
  if (handlers['message']) void handlers['message'](msg);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TelegramBridge — FIX-014 real routing', () => {
  let bridge: TelegramBridge;
  let adapter: TelegramChatAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    textHandlers.length = 0;
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    // Re-attach on/onText after clear
    mockBot.on.mockImplementation((event: string, cb: (...args: unknown[]) => unknown) => {
      handlers[event] = cb;
    });
    mockBot.onText.mockImplementation((re: RegExp, cb: (...args: unknown[]) => unknown) => {
      textHandlers.push([re, cb]);
    });

    adapter = { chat: vi.fn().mockResolvedValue('AI reply') };
    bridge = new TelegramBridge(adapter);
    await bridge.start('fake-token');

    const code = bridge.generatePairingCode('user-abc');
    fireText(`/pair ${code}`, '42');
    await new Promise((r) => setTimeout(r, 5));
  });

  it('routes message to adapter with correct userId', async () => {
    fireText('hello world', '42');
    await new Promise((r) => setTimeout(r, 10));
    expect(adapter.chat).toHaveBeenCalledWith('user-abc', 'hello world');
  });

  it('sends adapter response back to Telegram', async () => {
    mockBot.sendMessage.mockClear();
    fireText('hi', '42');
    await new Promise((r) => setTimeout(r, 10));
    expect(mockBot.sendMessage).toHaveBeenCalledWith(99, 'AI reply');
  });

  it('ignores messages from unpaired users', async () => {
    fireText('hi', '999');
    await new Promise((r) => setTimeout(r, 10));
    expect(adapter.chat).not.toHaveBeenCalled();
  });
});
