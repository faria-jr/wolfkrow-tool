import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogViewer } from '../log-viewer';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((ev: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { FakeEventSource.instances.push(this); }
}

describe('LogViewer', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders filter controls', () => {
    render(<LogViewer />);
    expect(screen.getByPlaceholderText(/level/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/module filter/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('displays entries pushed via EventSource', async () => {
    render(<LogViewer />);
    const es = FakeEventSource.instances[0]!;
    es.onmessage!({ data: JSON.stringify({ level: 'info', time: 1700000000000, msg: 'hello world' }) });
    expect(await screen.findByText('hello world')).toBeInTheDocument();
  });

  it('toggles pause/resume button', async () => {
    render(<LogViewer />);
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });
});
