import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    fit: vi.fn(),
    onData: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    cols: 80,
    rows: 24,
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })),
}));

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

vi.mock('@/hooks/use-pty', () => ({
  usePty: vi.fn(() => ({
    state: 'connecting',
    sessionId: null,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    onData: vi.fn().mockReturnValue(() => {}),
  })),
}));

import { Terminal } from '../terminal';

describe('Terminal', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders container with connecting state', () => {
    render(<Terminal />);
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('renders without autoConnect', () => {
    render(<Terminal autoConnect={false} />);
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });
});
