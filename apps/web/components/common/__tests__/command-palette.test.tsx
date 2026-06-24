import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRouter } from 'next/navigation';

import { CommandPalette } from '../command-palette';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('CommandPalette', () => {
  it('opens on Cmd+K', () => {
    const push = vi.fn();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push });
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText('Search pages...')).toBeInTheDocument();
  });

  it('opens on Ctrl+K', () => {
    const push = vi.fn();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push });
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText('Search pages...')).toBeInTheDocument();
  });

  it('renders navigation entries grouped', () => {
    const push = vi.fn();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push });
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
