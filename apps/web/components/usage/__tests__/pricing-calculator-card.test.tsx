import { fireEvent, render, screen } from '@testing-library/react';
import { defaultPricingCalculator, formatCost } from '@wolfkrow/domain/services';
import { describe, expect, it } from 'vitest';

import { PricingCalculatorCard } from '../pricing-calculator-card';

/**
 * P2-3 — Pricing calculator UI.
 *
 * The displayed cost MUST equal the domain's `defaultPricingCalculator.cost()`
 * for the same inputs. We compute the expected value in-test from the same
 * domain function so the assertion stays in sync with registry pricing without
 * hardcoding numbers.
 */
describe('PricingCalculatorCard', () => {
  it('renders a model selector populated from the catalog', () => {
    render(<PricingCalculatorCard />);
    // A known catalog model must appear as an option.
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument();
  });

  it('calculates a cost that matches the domain calculator for a known model', () => {
    render(<PricingCalculatorCard />);

    const select = screen.getByRole('combobox', { name: /model/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'claude-sonnet-4-6' } });

    const input = screen.getByLabelText(/input tokens/i) as HTMLInputElement;
    const output = screen.getByLabelText(/output tokens/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.change(output, { target: { value: '500' } });

    const usage = { inputTokens: 1000, outputTokens: 500 };
    const expectedUsd = defaultPricingCalculator
      .cost('claude-sonnet-4-6', usage)
      .toUSD();
    const expectedText = formatCost(expectedUsd);

    expect(screen.getByTestId('estimated-cost')).toHaveTextContent(expectedText);
  });

  it('includes cache tokens in the cost when provided (matches domain)', () => {
    render(<PricingCalculatorCard />);

    const select = screen.getByRole('combobox', { name: /model/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'claude-sonnet-4-6' } });

    const input = screen.getByLabelText(/input tokens/i) as HTMLInputElement;
    const output = screen.getByLabelText(/output tokens/i) as HTMLInputElement;
    const cacheRead = screen.getByLabelText(/cache read tokens/i) as HTMLInputElement;
    const cacheWrite = screen.getByLabelText(/cache write tokens/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.change(output, { target: { value: '300' } });
    fireEvent.change(cacheRead, { target: { value: '1000' } });
    fireEvent.change(cacheWrite, { target: { value: '500' } });

    const usage = { inputTokens: 2000, outputTokens: 300, cacheReadTokens: 1000, cacheWriteTokens: 500 };
    const expectedUsd = defaultPricingCalculator
      .cost('claude-sonnet-4-6', usage)
      .toUSD();

    expect(screen.getByTestId('estimated-cost')).toHaveTextContent(formatCost(expectedUsd));
  });

  it('shows an explicit unknown-pricing state (not a silent $0) for an unknown model', () => {
    render(<PricingCalculatorCard />);

    const select = screen.getByRole('combobox', { name: /model/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'totally-fake-model-xyz' } });

    // The unknown sentinel must render; the cost value must NOT show a $ figure.
    expect(screen.getByTestId('pricing-unknown')).toBeInTheDocument();
    expect(screen.queryByTestId('estimated-cost')).not.toBeInTheDocument();
  });

  it('treats empty/invalid token input as zero (no crash, $0 for known model)', () => {
    render(<PricingCalculatorCard />);

    const select = screen.getByRole('combobox', { name: /model/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'claude-sonnet-4-6' } });

    // Leave inputs empty — should render $0.00 (formatCost(0) → $0.00).
    expect(screen.getByTestId('estimated-cost')).toHaveTextContent('$0.00');
  });
});
