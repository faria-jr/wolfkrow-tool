import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TelegramSetup } from '../telegram-setup';

describe('TelegramSetup', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/pair')) {
        return Promise.resolve({ ok: true, json: async () => ({ code: 'ABC123' }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows stopped status by default', () => {
    render(<TelegramSetup />);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('starts bot and shows pairing option', async () => {
    render(<TelegramSetup />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate pairing code/i })).toBeInTheDocument();
  });

  it('generates pairing code', async () => {
    render(<TelegramSetup />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    const pairBtn = await screen.findByRole('button', { name: /generate pairing code/i });
    await userEvent.click(pairBtn);
    expect(await screen.findByDisplayValue('ABC123')).toBeInTheDocument();
  });
});
