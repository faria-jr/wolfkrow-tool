import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChannelsList } from '../channels-list';

vi.mock('../telegram-setup', () => ({
  TelegramSetup: () => <div>Telegram setup panel</div>,
}));

describe('ChannelsList', () => {
  it('renders channels as a data-driven configuration table with Telegram selected', () => {
    render(<ChannelsList />);

    expect(screen.getByRole('table', { name: 'Channel configuration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure Telegram' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure Discord' })).toBeDisabled();
    expect(screen.getByText('Telegram setup panel')).toBeInTheDocument();

    const telegramRow = screen.getByRole('row', { name: /telegram/i });
    expect(within(telegramRow).getByText('Available')).toBeInTheDocument();
    expect(within(telegramRow).getByText('Disconnected')).toBeInTheDocument();
  });
});
