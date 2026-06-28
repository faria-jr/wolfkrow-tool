/**
 * TelegramBridge — lifecycle + error-path branches not covered by the FIX-014
 * routing test: stop() no-op when not started, isStarted() false, handleMessage
 * without a chat adapter, handleMessage adapter failure, and the /start command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { TelegramBridge, type TelegramChatAdapter } from '../bridge';

beforeEach(() => {
  vi.clearAllMocks();
  textHandlers.length = 0;
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  mockBot.on.mockImplementation((event: string, cb: (...args: unknown[]) => unknown) => {
    handlers[event] = cb;
  });
  mockBot.onText.mockImplementation((re: RegExp, cb: (...args: unknown[]) => unknown) => {
    textHandlers.push([re, cb]);
  });
});

describe('TelegramBridge — lifecycle branches', () => {
  it('isStarted() is false before start()', () => {
    const bridge = new TelegramBridge();
    expect(bridge.isStarted()).toBe(false);
  });

  it('stop() is a no-op when the bot was never started', () => {
    const bridge = new TelegramBridge();
    expect(() => bridge.stop()).not.toThrow();
    expect(mockBot.stopPolling).not.toHaveBeenCalled();
  });

  it('stop() clears the bot and isStarted() becomes false', async () => {
    const bridge = new TelegramBridge();
    await bridge.start('token');
    expect(bridge.isStarted()).toBe(true);
    bridge.stop();
    expect(bridge.isStarted()).toBe(false);
  });
});

describe('TelegramBridge — /start command', () => {
  it('sends a welcome message on /start', async () => {
    const bridge = new TelegramBridge();
    await bridge.start('token');
    mockBot.sendMessage.mockClear();

    const msg = { chat: { id: 7 }, from: { id: 7 }, text: '/start' };
    for (const [re, cb] of textHandlers) {
      const m = '/start'.match(re);
      if (m) void cb(msg, m);
    }
    await new Promise((r) => setTimeout(r, 10));
    expect(mockBot.sendMessage).toHaveBeenCalledWith(7, expect.stringContaining('pair'));
  });
});

describe('TelegramBridge — handleMessage error paths', () => {
  it('warns when no chat adapter is configured', async () => {
    const bridge = new TelegramBridge(); // no adapter
    await bridge.start('token');
    const code = bridge.generatePairingCode('u1');
    const msg = { chat: { id: 3 }, from: { id: 55 }, text: `/pair ${code}` };
    for (const [re, cb] of textHandlers) {
      const m = msg.text!.match(re);
      if (m) void cb(msg, m);
    }
    await new Promise((r) => setTimeout(r, 10));

    mockBot.sendMessage.mockClear();
    // Fire a non-command message from the paired user.
    const follow = { chat: { id: 3 }, from: { id: 55 }, text: 'hello' };
    if (handlers['message']) void handlers['message'](follow);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockBot.sendMessage).toHaveBeenCalledWith(3, expect.stringContaining('not configured'));
  });

  it('sends an error message when the adapter throws', async () => {
    const adapter: TelegramChatAdapter = { chat: vi.fn().mockRejectedValue(new Error('boom')) };
    const bridge = new TelegramBridge(adapter);
    await bridge.start('token');
    const code = bridge.generatePairingCode('u2');
    const msg = { chat: { id: 4 }, from: { id: 66 }, text: `/pair ${code}` };
    for (const [re, cb] of textHandlers) {
      const m = msg.text!.match(re);
      if (m) void cb(msg, m);
    }
    await new Promise((r) => setTimeout(r, 10));

    mockBot.sendMessage.mockClear();
    const follow = { chat: { id: 4 }, from: { id: 66 }, text: 'hi' };
    if (handlers['message']) void handlers['message'](follow);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      4,
      expect.stringContaining('Error processing')
    );
  });
});
