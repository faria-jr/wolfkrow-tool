'use client';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from '@xterm/xterm';
import { useEffect, useRef } from 'react';

import { usePty } from '@/hooks/use-pty';

export interface TerminalProps {
  autoConnect?: boolean;
  className?: string;
}

export function Terminal({ autoConnect = true, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { connect, disconnect, write, resize, onData, state } = usePty();

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: { background: '#1a1a1a', foreground: '#d4d4d4' },
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const removeListener = onData((data) => term.write(data));

    term.onData((data) => write(data));

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      resize(term.cols, term.rows);
    });
    ro.observe(containerRef.current);

    if (autoConnect) {
      void connect(term.cols, term.rows);
    }

    return () => {
      removeListener();
      ro.disconnect();
      disconnect();
      term.dispose();
    };
  // Mount-once: xterm must be initialized exactly once per DOM node.
  // usePty callbacks are stable (useCallback), so omitting them from deps is safe.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-once for xterm imperative setup
  }, []);

  return (
    <div className={`relative overflow-hidden rounded bg-[#1a1a1a] ${className ?? ''}`}>
      {state === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          Connecting…
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
