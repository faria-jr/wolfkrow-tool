import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderList } from '../provider-list';

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

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const builtIn = {
  id: 'anthropic',
  displayName: 'Anthropic',
  protocol: 'anthropic-compat',
  baseUrl: 'https://api.anthropic.com',
  apiKeyAccount: 'anthropic',
  models: ['claude-sonnet-4-6'],
  supportsTools: true,
};

const custom = {
  id: 'custom1',
  displayName: 'Custom Provider',
  protocol: 'openai-compatible',
  baseUrl: 'https://api.example.com/v1',
  apiKeyAccount: 'custom1',
  models: ['m1'],
  supportsTools: false,
};

describe('ProviderList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders providers from API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [builtIn, custom],
    }) as unknown as typeof fetch);

    const Wrapper = makeWrapper();
    render(<ProviderList />, { wrapper: Wrapper });

    expect(await screen.findByText('Anthropic')).toBeTruthy();
    expect(await screen.findByText('Custom Provider')).toBeTruthy();
    expect(screen.getByText('Built-in')).toBeTruthy();
  });

  it('built-in provider does not show Delete button', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [builtIn],
    }) as unknown as typeof fetch);

    const Wrapper = makeWrapper();
    render(<ProviderList />, { wrapper: Wrapper });

    await screen.findByText('Anthropic');
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBe(0);
  });

  it('custom provider shows Delete button that opens confirmation', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [custom],
    }) as unknown as typeof fetch);

    const Wrapper = makeWrapper();
    render(<ProviderList />, { wrapper: Wrapper });

    await screen.findByText('Custom Provider');
    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    await user.click(deleteBtn);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText(/are you sure/i)).toBeTruthy();
  });

  it('cancel button closes confirmation dialog without deleting', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [custom],
    });
    vi.stubGlobal('fetch', fetchMock);

    const Wrapper = makeWrapper();
    render(<ProviderList />, { wrapper: Wrapper });

    await screen.findByText('Custom Provider');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('delete opens confirmation dialog with cancel/confirm buttons', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [custom],
    }) as unknown as typeof fetch);

    const Wrapper = makeWrapper();
    render(<ProviderList />, { wrapper: Wrapper });

    await screen.findByText('Custom Provider');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Are you sure');
    expect(dialog.textContent).toContain(custom.displayName);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
  });

  it('cancel button closes confirmation dialog without deleting', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [custom],
    });
    vi.stubGlobal('fetch', fetchMock);

    const Wrapper = makeWrapper();
    render(<ProviderList />, { wrapper: Wrapper });

    await screen.findByText('Custom Provider');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
