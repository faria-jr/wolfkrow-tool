import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/catalog')) {
        return {
          ok: true,
          json: async () => ({ builtIn: [], planned: [] }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ servers: [makeServer()] }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders Add server button enabled', async () => {
    render(<McpServersView />);
    const btn = await waitFor(() => screen.getByRole('button', { name: /add server/i }));
    expect(btn).toBeDefined();
    expect(btn).not.toBeDisabled();
  });

  it('shows error state when server list fetch fails and allows retry', async () => {
    fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/catalog')) {
        return {
          ok: true,
          json: async () => ({ builtIn: [], planned: [] }),
        } as Response;
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'server error' }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<McpServersView />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /failed to load mcp servers/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });
});
