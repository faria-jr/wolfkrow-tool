import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '../confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog open={false} title="Delete?" description="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('renders with title and description when open', () => {
    render(
      <ConfirmDialog open={true} title="Clear chat?" description="This cannot be undone." onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Clear chat?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog open={true} title="Clear?" description="Sure?" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog open={true} title="Clear?" description="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses custom confirmLabel when provided', () => {
    render(
      <ConfirmDialog open={true} title="Delete?" description="Sure?" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});
