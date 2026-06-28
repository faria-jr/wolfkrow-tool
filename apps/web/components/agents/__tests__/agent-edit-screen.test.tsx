import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentEditScreen } from '../agent-edit-screen';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
});

const agentFixture = {
  id: 'a-1',
  name: 'researcher',
  description: 'Research agent',
  model: 'claude-sonnet-4-6',
  effort: 'medium',
  thinking: false,
  maxTurns: 12,
  allowedTools: [],
  mcpServers: [],
  isActive: true,
  skills: [],
  runtime: 'cloud',
  provider: '',
  systemPrompt: '# Existing prompt\n\nYou research things.',
};

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>;
}

function mockJsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function handleProviders(): Response {
  return mockJsonResponse([]);
}

function handleAgentGet(): Response {
  return mockJsonResponse({ agent: agentFixture });
}

function handleAgentPut(): Response {
  return mockJsonResponse({ agent: agentFixture });
}

function handleAgentNotFound(): Response {
  return mockJsonResponse({ error: 'Agent not found' }, 404);
}

interface FetchRouteOpts {
  notFound?: boolean;
}

/** URL-aware fetch mock so `/api/providers` doesn't return the agent payload
 *  (which would break `providers.find(...)` inside ModelSection). */
function setupFetch(_opts: FetchRouteOpts = {}) {
  const calls: Array<[string, RequestInit | undefined]> = [];
  const handler = (input: RequestInfo | URL, init?: RequestInit): Response => {
    const url = String(input);
    calls.push([url, init]);
    if (url.endsWith('/api/providers')) return handleProviders();
    if (_opts.notFound) return handleAgentNotFound();
    const method = init?.method ?? 'GET';
    if (url.includes('/api/agents/') && method === 'GET') return handleAgentGet();
    if (url.includes('/api/agents/') && method === 'PUT') return handleAgentPut();
    return mockJsonResponse({});
  };
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(input, init)
  ) as unknown as typeof fetch;
  return calls;
}

describe('AgentEditScreen (EPIC 1.1)', () => {
  let push: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  it('renders loading state then prefills the form from GET /api/agents/[id]', async () => {
    setupFetch();
    render(<AgentEditScreen agentId="a-1" />, { wrapper: Providers });
    expect(screen.getByText(/loading agent/i)).toBeTruthy();
    await waitFor(() => {
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('researcher');
    });
    expect((screen.getByLabelText(/system prompt/i) as HTMLTextAreaElement).value).toContain(
      'Existing prompt'
    );
  });

  it('submits PUT to /api/agents/[id] and redirects to /agents on success', async () => {
    const calls = setupFetch();
    const user = userEvent.setup();
    render(<AgentEditScreen agentId="a-1" />, { wrapper: Providers });
    await waitFor(() => {
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('researcher');
    });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const putCall = calls.find(
        ([url, init]) => url === '/api/agents/a-1' && init?.method === 'PUT'
      );
      expect(putCall).toBeTruthy();
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/agents');
    });
  });

  it('shows destructive alert when GET fails', async () => {
    setupFetch({ notFound: true });
    render(<AgentEditScreen agentId="missing" />, { wrapper: Providers });
    await waitFor(() => {
      expect(screen.getByText(/could not load agent/i)).toBeTruthy();
    });
    expect(screen.getByText(/agent not found/i)).toBeTruthy();
  });
});
