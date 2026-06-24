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

const summaryWithModels = {
  ...summary,
  byModel: {
    'claude-sonnet-4-6': { inputTokens: 5000, outputTokens: 2000, costUSD: 0.0045 },
    'my-custom-unknown-model': { inputTokens: 1000, outputTokens: 500, costUSD: 0 },
  },
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

describe('UsageCharts — model breakdown table (RM6.2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows Cost (USD) column header when models present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => summaryWithModels,
    } as Response));

    render(<UsageCharts />);
    await waitFor(() => expect(screen.getByText('Cost (USD)')).toBeInTheDocument());
  });

  it('shows formatted cost for known model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => summaryWithModels,
    } as Response));

    render(<UsageCharts />);
    await waitFor(() => expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument());
    // costUSD 0.0045 < 0.01 → formatCost → "$0.0045"
    expect(screen.getByText('$0.0045')).toBeInTheDocument();
  });

  it('shows "unknown" badge for model without known pricing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => summaryWithModels,
    } as Response));

    render(<UsageCharts />);
    await waitFor(() => expect(screen.getByText('my-custom-unknown-model')).toBeInTheDocument());
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});
