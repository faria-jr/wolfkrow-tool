import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionConfigView } from '../session-config-view';

describe('SessionConfigView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        studioUrl: 'http://127.0.0.1:7460/projects/wolfkrow-acme?host=wolfkrow',
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the agent, model and design-system fields', () => {
    render(
      <SessionConfigView
        wolfkrowProjectId="acme"
        name="Acme CRM"
        specContent="Build a CRM."
        onStudioUrl={() => {}}
      />
    );
    expect(screen.getByText('Design session')).toBeInTheDocument();
    expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/design system/i)).toBeInTheDocument();
  });

  it('submits the bootstrap payload and surfaces the studio url', async () => {
    const onStudioUrl = vi.fn();
    render(
      <SessionConfigView
        wolfkrowProjectId="acme"
        name="Acme CRM"
        specContent="Build a CRM."
        onStudioUrl={onStudioUrl}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/open-design/bootstrap');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      wolfkrowProjectId: 'acme',
      name: 'Acme CRM',
      specContent: 'Build a CRM.',
    });
    expect(onStudioUrl).toHaveBeenCalledWith(
      'http://127.0.0.1:7460/projects/wolfkrow-acme?host=wolfkrow'
    );
  });

  it('surfaces a bootstrap error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Engine unavailable' }),
    } as Response);
    render(
      <SessionConfigView
        wolfkrowProjectId="acme"
        name="Acme"
        specContent="x"
        onStudioUrl={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /start session/i }));
    await waitFor(() => expect(screen.getByText(/Engine unavailable/i)).toBeInTheDocument());
  });
});
