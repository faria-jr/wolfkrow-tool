import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveRunsBar } from '../active-runs-bar';

let originalFetch: typeof globalThis.fetch;

function mockFetch(harness: unknown[], pipeline: unknown[]) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = url.includes('/api/harness/projects') ? harness : pipeline;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('ActiveRunsBar (DEBT #13)', () => {
  it('renders nothing when there are no active runs', async () => {
    mockFetch(
      [{ id: 'h1', name: 'Done', status: 'completed' }],
      [{ id: 'p1', name: 'Idle', status: 'paused' }]
    );
    const { container } = render(<ActiveRunsBar />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('lists running harness + pipeline projects with a click-through', async () => {
    mockFetch(
      [{ id: 'h1', name: 'Harness running', status: 'running' }],
      [{ id: 'p1', name: 'Pipeline active', status: 'active' }]
    );
    render(<ActiveRunsBar />);
    await waitFor(() => expect(screen.getByText('Harness running')).toBeInTheDocument());
    expect(screen.getByText('Pipeline active')).toBeInTheDocument();
    expect(screen.getByText(/Active \(2\)/)).toBeInTheDocument();
  });
});
