import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '../command-palette';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

function setupPalette() {
  const push = vi.fn();
  (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push });
  const user = userEvent.setup();
  render(<CommandPalette />);
  return { push, user };
}

async function openPalette(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('{Meta>}k{/Meta}');
}

describe('CommandPalette', () => {
  it('opens on Cmd+K', async () => {
    const { user } = setupPalette();
    await openPalette(user);
    expect(screen.getByPlaceholderText('Search pages...')).toBeInTheDocument();
  });

  it('opens on Ctrl+K', async () => {
    const { user } = setupPalette();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByPlaceholderText('Search pages...')).toBeInTheDocument();
  });

  it('renders navigation entries grouped', async () => {
    const { user } = setupPalette();
    await openPalette(user);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('navigates to /chat when Chat item is selected', async () => {
    const { push, user } = setupPalette();
    await openPalette(user);
    await user.click(screen.getByText('Chat'));
    expect(push).toHaveBeenCalledWith('/chat');
  });

  it('runs onSelect handler for non-navigation actions', async () => {
    const { user } = setupPalette();
    await openPalette(user);
    await user.click(screen.getByText('Toggle theme'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
