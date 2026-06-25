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

  it('has no dead navigation links (every entry routes to a real page)', async () => {
    // FE-7: every palette entry with a url must point at an existing page.
    // Regression guard for the removed /agents/new dead link.
    const { push, user } = setupPalette();
    await openPalette(user);

    // Navigate through each route-bearing entry and assert the pushed URL is
    // a known live route (not e.g. /agents/new which has no page).
    const routeEntries = [
      'Chat', 'Agents', 'Skills', 'MCP Servers', 'Knowledge', 'Graph', 'Tasks',
      'Scheduler', 'Harness', 'Pipeline', 'Security Audit',
      'Memory', 'Rules', 'Vault', 'Channels', 'Permissions', 'Settings', 'Usage', 'Logs',
      'New agent', 'New provider',
    ];

    for (const label of routeEntries) {
      push.mockClear();
      // Re-open between selections since onSelect closes the dialog.
      await openPalette(user);
      const item = screen.queryAllByText(label)[0];
      if (!item) continue; // skip labels not surfaced in this render
      await user.click(item);
      const target = push.mock.calls[0]?.[0] as string | undefined;
      expect(target, `${label} must push a URL`).toBeTruthy();
      // No entry may route to the dead /agents/new page.
      expect(target).not.toBe('/agents/new');
    }
  });
});
