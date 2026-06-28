'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const WORKER = process.env['NEXT_PUBLIC_WORKER_URL'] ?? 'http://localhost:4000';
const WS_WORKER = WORKER.replace(/^http/, 'ws');

export type PtyState = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface UsePtyReturn {
  state: PtyState;
  sessionId: string | null;
  connect: (cols: number, rows: number) => Promise<void>;
  disconnect: () => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  onData: (listener: (data: string) => void) => () => void;
}

/** Wire WebSocket lifecycle + message handlers onto the socket. */
function attachWsHandlers(
  ws: WebSocket,
  opts: {
    setState: (s: PtyState) => void;
    setSessionId: (id: string | null) => void;
    listeners: Set<(data: string) => void>;
    cols: number;
    rows: number;
  }
): void {
  ws.onopen = () => {
    opts.setState('connected');
    ws.send(JSON.stringify({ type: 'resize', cols: opts.cols, rows: opts.rows }));
  };
  ws.onclose = () => {
    opts.setState('disconnected');
    opts.setSessionId(null);
  };
  ws.onerror = () => opts.setState('disconnected');
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data as string) as { type: string; data?: string };
    if (msg.type === 'output' && msg.data) {
      for (const listener of opts.listeners) listener(msg.data);
    }
  };
}

export function usePty(): UsePtyReturn {
  const [state, setState] = useState<PtyState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dataListeners = useRef<Set<(data: string) => void>>(new Set());

  const onData = useCallback((listener: (data: string) => void) => {
    dataListeners.current.add(listener);
    return () => {
      dataListeners.current.delete(listener);
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close(1000);
    wsRef.current = null;
    setState('disconnected');
    setSessionId(null);
  }, []);

  const connect = useCallback(async (cols: number, rows: number) => {
    setState('connecting');

    const res = await fetch(`${WORKER}/pty`, { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      setState('disconnected');
      return;
    }
    const { sessionId: id } = (await res.json()) as { sessionId: string };
    setSessionId(id);

    const ws = new WebSocket(`${WS_WORKER}/pty/${id}`);
    wsRef.current = ws;
    attachWsHandlers(ws, {
      setState,
      setSessionId,
      listeners: dataListeners.current,
      cols,
      rows,
    });
  }, []);

  const write = useCallback((data: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'input', data }));
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    wsRef.current?.send(JSON.stringify({ type: 'resize', cols, rows }));
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { state, sessionId, connect, disconnect, write, resize, onData };
}
