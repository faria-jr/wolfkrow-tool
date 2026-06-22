import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="container">{children}</div>,
  };
});

import { UsageCharts } from '../usage-charts';

const summary = {
  totalInputTokens: 1000,
  totalOutputTokens: 500,
  totalCostUSD: 0.5,
  byModel: {},
  bySource: { chat: { inputTokens: 100, outputTokens: 50, costUSD: 0.1 } },
  byDay: { '2024-01-01': { inputTokens: 100, outputTokens: 50, costUSD: 0.1 } },
};

describe('UsageCharts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => summary,
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows loading state initially', () => {
    render(<UsageCharts />);
    expect(screen.getByText(/loading usage data/i)).toBeInTheDocument();
  });

  it('renders summary cards after load', async () => {
    render(<UsageCharts />);
    await waitFor(() => expect(screen.getByText('1,000')).toBeInTheDocument());
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('Total Input Tokens')).toBeInTheDocument();
    expect(screen.getByText('Total Output Tokens')).toBeInTheDocument();
  });

  it('renders chart section headers', async () => {
    render(<UsageCharts />);
    await waitFor(() => expect(screen.getByText('Cost per Day')).toBeInTheDocument());
    expect(screen.getByText('Cost by Source')).toBeInTheDocument();
  });
});
