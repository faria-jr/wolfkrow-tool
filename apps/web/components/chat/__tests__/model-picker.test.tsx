import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelPicker, useProviders } from '../model-picker';

let originalFetch: typeof globalThis.fetch;

const PROVIDERS = [
  { id: 'anthropic', displayName: 'Anthropic', models: ['claude-sonnet-4-6', 'claude-opus-4-8'] },
  { id: 'glm', displayName: 'GLM', models: ['glm-4.6'] },
];

function mockProvidersOk() {
  global.fetch = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => PROVIDERS }) as Response
  ) as unknown as typeof fetch;
}
function mockProvidersEmpty() {
  global.fetch = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => [] }) as Response
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function Probe() {
  const { providers, loading } = useProviders();
  return (
    <div data-testid="probe">
      {loading ? 'loading' : providers.map((p) => p.models.join(',')).join('|')}
    </div>
  );
}

describe('useProviders', () => {
  it('loads configured providers with their models', async () => {
    mockProvidersOk();
    render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toBe(
        'claude-sonnet-4-6,claude-opus-4-8|glm-4.6'
      )
    );
  });

  it('drops providers with no models', async () => {
    global.fetch = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => [
            { id: 'a', displayName: 'A', models: ['m'] },
            { id: 'b', displayName: 'B', models: [] },
          ],
        }) as Response
    ) as unknown as typeof fetch;
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('m'));
  });
});

describe('ModelPicker', () => {
  it('renders the active model read-only when no providers are configured', async () => {
    mockProvidersEmpty();
    render(<ModelPicker value="claude-sonnet-4-6" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument());
  });

  it('renders a combobox when providers are available', async () => {
    mockProvidersOk();
    render(<ModelPicker value="glm-4.6" onChange={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /select model/i })).toBeInTheDocument()
    );
  });
});
