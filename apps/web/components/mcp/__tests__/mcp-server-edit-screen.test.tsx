import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpServerEditScreen } from '../mcp-server-edit-screen';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const serverFixture = {
  id: 's1',
  userId: 'u1',
  name: 'filesystem',
  description: 'Local files',
  command: 'npx',
  args: ['-y', 'server-filesystem'],
  env: { ROOT: '/tmp' },
  isActive: true,
  isBuiltIn: false,
  visibility: 'always',
  healthCheck: 'tools/list',
  metadata: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('McpServerEditScreen (EPIC 1.4)', () => {
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  it('loads an existing custom server into the dedicated edit screen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ servers: [serverFixture] })));

    render(<McpServerEditScreen serverId="s1" />);

    await waitFor(() =>
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('filesystem')
    );
    expect((screen.getByLabelText(/command/i) as HTMLInputElement).value).toBe('npx');
    expect((screen.getByLabelText(/args/i) as HTMLTextAreaElement).value).toContain(
      'server-filesystem'
    );
    expect((screen.getByLabelText(/env/i) as HTMLTextAreaElement).value).toContain('ROOT=/tmp');
  });

  it('saves custom server changes with PATCH and returns to the list', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return response({ server: serverFixture });
      return response({ servers: [serverFixture] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<McpServerEditScreen serverId="s1" />);
    await waitFor(() => expect(screen.getByLabelText(/name/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/mcp-servers/s1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
    expect(push).toHaveBeenCalledWith('/mcp-servers');
  });

  it('creates a custom server with POST from the dedicated screen', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ server: serverFixture }, 201));
    vi.stubGlobal('fetch', fetchMock);

    render(<McpServerEditScreen />);
    await userEvent.type(screen.getByLabelText(/name/i), 'filesystem');
    await userEvent.type(screen.getByLabelText(/command/i), 'npx');
    await userEvent.click(screen.getByRole('button', { name: /create server/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/mcp-servers',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(push).toHaveBeenCalledWith('/mcp-servers');
  });
});
