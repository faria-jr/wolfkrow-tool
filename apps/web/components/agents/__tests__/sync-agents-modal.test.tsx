import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncAgentsModal } from '../sync-agents-modal';

describe('SyncAgentsModal', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ synced: 2 }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing visible when closed', () => {
    render(<SyncAgentsModal open={false} onClose={vi.fn()} onSynced={vi.fn()} agentCount={2} />);
    expect(screen.queryByText(/Sync Agents to Orchestrator/i)).not.toBeInTheDocument();
  });

  it('renders agent count when open', () => {
    render(<SyncAgentsModal open onClose={vi.fn()} onSynced={vi.fn()} agentCount={3} />);
    expect(screen.getByText(/all 3 agent\(s\)/i)).toBeInTheDocument();
  });

  it('posts sync on confirm and shows result', async () => {
    const onSynced = vi.fn();
    render(<SyncAgentsModal open onClose={vi.fn()} onSynced={onSynced} agentCount={1} />);
    await userEvent.click(screen.getByRole('button', { name: /sync all agents/i }));
    expect(await screen.findByText(/2 agent\(s\) updated/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    expect(onSynced).toHaveBeenCalled();
  });
});
