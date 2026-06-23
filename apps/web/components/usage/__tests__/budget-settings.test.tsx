import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BudgetSettings } from '../budget-settings';

describe('BudgetSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders an input with default value of 50 when localStorage is empty', () => {
    render(<BudgetSettings />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(50);
  });

  it('reads initial value from localStorage when present', () => {
    localStorage.setItem('wolfkrow:budget_usd', '120');
    render(<BudgetSettings />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(120);
  });

  it('saves the new value to localStorage when Save is clicked', async () => {
    const user = userEvent.setup();
    render(<BudgetSettings />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '75');

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(localStorage.getItem('wolfkrow:budget_usd')).toBe('75');
  });

  it('dispatches wolfkrow:budget-changed CustomEvent after saving', async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener('wolfkrow:budget-changed', listener);

    render(<BudgetSettings />);
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '200');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));

    window.removeEventListener('wolfkrow:budget-changed', listener);
  });

  it('disables the Save button when value is 0', async () => {
    const user = userEvent.setup();
    render(<BudgetSettings />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '0');

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('disables the Save button when value is negative', async () => {
    const user = userEvent.setup();
    render(<BudgetSettings />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '-5');

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('disables the Save button when the field is empty (NaN)', async () => {
    const user = userEvent.setup();
    render(<BudgetSettings />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('shows the current budget value in the UI', () => {
    localStorage.setItem('wolfkrow:budget_usd', '99');
    render(<BudgetSettings />);
    expect(screen.getByText(/\$99/)).toBeInTheDocument();
  });

  it('shows a success confirmation message after saving', async () => {
    const user = userEvent.setup();
    render(<BudgetSettings />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '80');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
  });
});
