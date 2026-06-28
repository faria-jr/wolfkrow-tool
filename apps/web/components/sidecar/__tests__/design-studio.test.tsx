import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DesignStudio } from '../design-studio';

describe('DesignStudio', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ state: { status: 'stopped' } }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders studio status and start button initially', async () => {
    render(<DesignStudio />);
    expect(await screen.findByText(/Click Start Engine to launch/i)).toBeInTheDocument();
  });

  it('starts the studio on Start click', async () => {
    render(<DesignStudio />);
    const start = await screen.findByRole('button', { name: /Start Engine/i });
    await userEvent.click(start);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/open-design?action=start', { method: 'POST' })
    );
  });

  it('iframes the engine webUrl when running', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ state: { status: 'running', webUrl: 'http://127.0.0.1:7460/' } }),
    } as Response);
    render(<DesignStudio />);
    const frame = await screen.findByTitle('Open Design Studio');
    expect(frame).toHaveAttribute('src', 'http://127.0.0.1:7460/');
  });
});
