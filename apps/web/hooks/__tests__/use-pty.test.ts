import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePty } from '../use-pty';

class FakeWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
}

describe('usePty', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'sess-1' }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts idle', () => {
    const { result } = renderHook(() => usePty());
    expect(result.current.state).toBe('idle');
    expect(result.current.sessionId).toBeNull();
  });

  it('connect sets sessionId via fetch', async () => {
    const { result } = renderHook(() => usePty());
    await act(async () => {
      await result.current.connect(80, 24);
    });
    await waitFor(() => expect(result.current.sessionId).toBe('sess-1'));
  });

  it('disconnect resets state', async () => {
    const { result } = renderHook(() => usePty());
    await act(async () => {
      await result.current.connect(80, 24);
    });
    act(() => result.current.disconnect());
    expect(result.current.state).toBe('disconnected');
  });

  it('onData registers a listener', () => {
    const { result } = renderHook(() => usePty());
    const unsub = result.current.onData(vi.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });
});
