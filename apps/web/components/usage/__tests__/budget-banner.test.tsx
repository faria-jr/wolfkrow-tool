import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BudgetBanner } from '../budget-banner';

/**
 * FIX-032: the /usage/budget endpoint existed but the UI never consumed it, so
 * budget overruns were invisible. BudgetBanner surfaces them.
 */
describe('BudgetBanner (FIX-032)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function stubBudget(payload: unknown) {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  }

  afterEach(() => vi.unstubAllGlobals());

  it('shows an exceeded banner when budget is exceeded', async () => {
    stubBudget({ spentUSD: 60, budgetUSD: 50, percentUsed: 120, exceeded: true });
    render(<BudgetBanner />);
    await waitFor(() => expect(screen.getByText(/budget exceeded/i)).toBeInTheDocument());
    expect(screen.getByText(/\$60/)).toBeInTheDocument();
    expect(screen.getByText(/\$50/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/usage/budget'));
  });

  it('shows a warning when usage approaches the limit (>=80%)', async () => {
    stubBudget({ spentUSD: 42, budgetUSD: 50, percentUsed: 84, exceeded: false });
    render(<BudgetBanner />);
    await waitFor(() => expect(screen.getByText(/approaching budget limit/i)).toBeInTheDocument());
  });

  it('renders nothing when usage is comfortably under budget', async () => {
    stubBudget({ spentUSD: 5, budgetUSD: 50, percentUsed: 10, exceeded: false });
    const { container } = render(<BudgetBanner />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Give the state update a tick to settle, then assert empty.
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe('');
  });

  it('renders nothing when the budget fetch fails', async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<BudgetBanner />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe('');
  });
});
