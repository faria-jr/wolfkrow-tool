import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LockedDesignViewer } from '../locked-design-viewer';

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('LockedDesignViewer', () => {
  it('renders the artifact HTML in a sandboxed iframe', async () => {
    global.fetch = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            html: '<html><body>Design</body></html>',
            artifactPath: 'index.html',
          }),
        }) as Response
    ) as unknown as typeof fetch;

    render(<LockedDesignViewer odProjectId="wolfkrow-acme" />);
    const frame = await waitFor(async () => {
      const f = await screen.findByTitle('Locked design preview');
      expect(f).toBeInTheDocument();
      return f;
    });
    expect(frame.getAttribute('srcDoc')).toContain('Design');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('shows an empty state when no artifact exists', async () => {
    global.fetch = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ html: null, artifactPath: null }),
        }) as Response
    ) as unknown as typeof fetch;

    render(<LockedDesignViewer odProjectId="wolfkrow-acme" />);
    await waitFor(() => expect(screen.getByText(/No design artifact/i)).toBeInTheDocument());
  });

  it('surfaces a fetch error', async () => {
    global.fetch = vi.fn(
      async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response
    ) as unknown as typeof fetch;
    render(<LockedDesignViewer odProjectId="p" />);
    await waitFor(() => expect(screen.getByText(/HTTP 503/)).toBeInTheDocument());
  });
});
