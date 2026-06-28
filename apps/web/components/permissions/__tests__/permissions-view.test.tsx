import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { PermissionsView } from '../permissions-view';

// Radix Select needs pointer-capture APIs that jsdom does not implement.
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

interface AgentData {
  id?: string;
  name: string;
  allowedTools: string[];
}

/**
 * Router-style fetch mock: dispatches by URL + method so the parallel initial
 * loads and subsequent mutations are all handled from one stub. Routes receive
 * the parsed JSON body directly (the component sends relative URLs, which
 * cannot be wrapped in `new Request()` under jsdom).
 */
type RouteHandlers = {
  agents?: (req: { method: string; body: unknown }) => Response | Promise<Response>;
  decisions?: {
    GET?: () => Response | Promise<Response>;
    PUT?: (body: unknown) => Response | Promise<Response>;
    DELETE?: (body: unknown) => Response | Promise<Response>;
  };
};

function parseBody(init?: RequestInit): unknown {
  if (!init?.body) return undefined;
  try {
    return JSON.parse(typeof init.body === 'string' ? init.body : '');
  } catch {
    return undefined;
  }
}

function routeAgents(
  routes: RouteHandlers,
  method: string,
  body: unknown
): Response | Promise<Response> | null {
  return routes.agents ? routes.agents({ method, body }) : null;
}

function routeDecisions(
  routes: RouteHandlers,
  method: string,
  body: unknown
): Response | Promise<Response> | null {
  const d = routes.decisions;
  if (!d) return null;
  if (method === 'GET' && d.GET) return d.GET();
  if (method === 'PUT' && d.PUT) return d.PUT(body);
  if (method === 'DELETE' && d.DELETE) return d.DELETE(body);
  return null;
}

function mockFetchRouter(routes: RouteHandlers): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = parseBody(init);
    if (url.includes('/api/agents')) {
      const hit = routeAgents(routes, method, body);
      if (hit) return hit;
    }
    if (url.includes('/api/permissions/decisions')) {
      const hit = routeDecisions(routes, method, body);
      if (hit) return hit;
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as unknown as ReturnType<typeof vi.fn>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function agentsPayload(agents: AgentData[]): Response {
  return jsonResponse({ agents });
}

function decisionsPayload(
  decisions: { agentId: string; tool: string; decision: 'allow' | 'deny' }[]
): Response {
  return jsonResponse({ decisions });
}

describe('PermissionsView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let putSpy: ReturnType<typeof vi.fn>;
  let deleteSpy: ReturnType<typeof vi.fn>;

  const AGENTS: AgentData[] = [
    { id: 'a1', name: 'Alpha', allowedTools: ['Bash:rm', 'Read'] },
    { id: 'a2', name: 'Bravo', allowedTools: ['Write'] },
  ];

  beforeEach(() => {
    putSpy = vi.fn();
    deleteSpy = vi.fn();
    fetchMock = mockFetchRouter({
      agents: () => agentsPayload(AGENTS),
      decisions: {
        GET: () => decisionsPayload([{ agentId: 'a1', tool: 'Read', decision: 'allow' }]),
        PUT: (body) => {
          putSpy(body);
          return jsonResponse({ ok: true });
        },
        DELETE: (body) => {
          deleteSpy(body);
          return jsonResponse({ ok: true });
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads agents and renders the selected agent tools', async () => {
    render(<PermissionsView />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    // Alpha is selected first; its tools render.
    expect(await screen.findByText('Bash:rm')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('reflects a stored allow decision and an ask default (no stored row)', async () => {
    render(<PermissionsView />);
    // Read has a stored 'allow'; Bash:rm has none → 'ask'.
    await waitFor(() => expect(screen.getByText('Read')).toBeInTheDocument());
    expect(screen.getAllByText('Allow').length).toBeGreaterThan(0);
    // 'Ask' appears as the badge for Bash:rm and as a Select option.
    expect(screen.getAllByText('Ask').length).toBeGreaterThan(0);
  });

  it('persists a change to deny with the right payload', async () => {
    const user = userEvent.setup();
    render(<PermissionsView />);
    await waitFor(() => expect(screen.getByText('Bash:rm')).toBeInTheDocument());

    // The Bash:rm row's select currently shows 'Ask'. Open and pick 'Deny'.
    const triggers = screen.getAllByRole('combobox');
    // First trigger belongs to the first tool (Bash:rm) in the list.
    const first = triggers[0];
    if (!first) throw new Error('expected select trigger');
    await user.click(first);
    await user.click(await screen.findByRole('option', { name: 'Deny' }));

    await waitFor(() =>
      expect(putSpy).toHaveBeenCalledWith({
        agentId: 'a1',
        tool: 'Bash:rm',
        decision: 'deny',
      })
    );
  });

  it('resets to ask via DELETE when the user picks Ask on a stored decision', async () => {
    const user = userEvent.setup();
    render(<PermissionsView />);
    await waitFor(() => expect(screen.getByText('Read')).toBeInTheDocument());

    // Read has stored 'allow'. Its select is the second trigger (tools order: Bash:rm, Read).
    const triggers = screen.getAllByRole('combobox');
    const second = triggers[1];
    if (!second) throw new Error('expected select trigger');
    await user.click(second);
    await user.click(await screen.findByRole('option', { name: 'Ask' }));

    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith({
        agentId: 'a1',
        tool: 'Read',
      })
    );
  });

  it('switches agent on click', async () => {
    const user = userEvent.setup();
    render(<PermissionsView />);
    await waitFor(() => expect(screen.getByText('Bravo')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Bravo' }));
    expect(await screen.findByText('Write')).toBeInTheDocument();
  });

  it('shows an empty state when the agent declares no tools', async () => {
    fetchMock = mockFetchRouter({
      agents: () => agentsPayload([{ id: 'a1', name: 'Empty', allowedTools: [] }]),
      decisions: { GET: () => decisionsPayload([]) },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<PermissionsView />);
    await waitFor(() => expect(screen.getByText(/declares no tools/i)).toBeInTheDocument());
  });

  it('shows an error state when the agents load fails', async () => {
    fetchMock = mockFetchRouter({
      agents: () => new Response('boom', { status: 500 }),
      decisions: { GET: () => decisionsPayload([]) },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<PermissionsView />);
    expect(await screen.findByText(/failed to load agents/i)).toBeInTheDocument();
  });
});
