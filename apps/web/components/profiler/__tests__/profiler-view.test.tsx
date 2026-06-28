import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilerView } from '../profiler-view';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_PROFILE = {
  root: '/tmp/repo',
  languages: ['TypeScript', 'Python'],
  frameworks: ['Next.js', 'FastAPI'],
  roles: {
    'backend/src/server.ts': ['backend'],
    'apps/web/app/page.tsx': ['frontend'],
  },
  fileCount: 42,
  summary: 'A polyglot repo.',
};

describe('ProfilerView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(SAMPLE_PROFILE))
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders the form with the Profile button', () => {
    render(<ProfilerView />);
    expect(screen.getByPlaceholderText(/absolute\/path/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile$/i })).toBeDisabled();
  });

  it('shows the empty state before any profile is run', () => {
    render(<ProfilerView />);
    expect(screen.getByText(/no profile yet/i)).toBeInTheDocument();
  });

  it('submits the directory and renders languages, frameworks and summary', async () => {
    const user = userEvent.setup();
    render(<ProfilerView />);

    const input = screen.getByPlaceholderText(/absolute\/path/i);
    await user.type(input, '/tmp/repo');
    await user.click(screen.getByRole('button', { name: /profile$/i }));

    expect(await screen.findByText('A polyglot repo.')).toBeInTheDocument();
    // fileCount (42) renders in its own span; the "files scanned" label follows.
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText(/files scanned/i)).toBeInTheDocument();

    // Languages render as badges.
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    // Frameworks render as badges.
    expect(screen.getByText('Next.js')).toBeInTheDocument();
    expect(screen.getByText('FastAPI')).toBeInTheDocument();

    // Fetch was called with the expected payload.
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profiler',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ dir: '/tmp/repo' }),
      })
    );
  });

  it('shows an error state when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'boom' }, 500))
    );
    const user = userEvent.setup();
    render(<ProfilerView />);

    await user.type(screen.getByPlaceholderText(/absolute\/path/i), '/bad');
    await user.click(screen.getByRole('button', { name: /profile$/i }));

    expect(await screen.findByText(/profiler failed/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});
