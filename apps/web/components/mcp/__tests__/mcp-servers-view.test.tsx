import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { McpServersView } from '../mcp-servers-view';

function makeServer() {
  return {
    id: 's1', userId: 'u1', name: 'filesystem', description: 'fs',
    command: 'npx', args: ['server'], env: {}, isActive: true, isBuiltIn: false,
    visibility: 'always' as const, healthCheck: null, metadata: null,
    createdAt: '2024-01-01', updatedAt: '2024-01-01',
  };
}

describe('McpServersView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ servers: [makeServer()] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders Add server button', () => {
    render(<McpServersView />);
    expect(screen.getByRole('button', { name: /add server/i })).toBeDisabled();
  });

  it('loads servers and displays them', async () => {
    render(<McpServersView />);
    await waitFor(() => expect(screen.getByText('filesystem')).toBeInTheDocument());
  });
});
