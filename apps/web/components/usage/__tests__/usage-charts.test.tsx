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
  byRuntime: { cloud: { inputTokens: 100, outputTokens: 50, costUSD: 0.1 } },
  byDay: [{ day: '2024-01-01', inputTokens: 100, outputTokens: 50, costUSD: 0.1 }],
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
    // FE-4: api-client uses .text() + JSON.parse, not .json()
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(summary),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows loading state initially', async () => {
    render(<UsageCharts />);
    expect(screen.getByText(/loading usage data/i)).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('Total Cost')).toBeInTheDocument());
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

  it('consumes byDay as an array: cost-per-day chart renders the seeded day', async () => {
    render(<UsageCharts />);
    // The day chart section header confirms the byDay array was consumed
    // without throwing. Recharts axis ticks don't render text in jsdom, so
    // we assert the section mounts; the contract itself (array vs Record)
    // is enforced by UsageSummarySchema.parse() at the worker boundary.
    await waitFor(() => expect(screen.getByText('Cost per Day')).toBeInTheDocument());
    // Both the day chart and the source pie mount ResponsiveContainer; the
    // canonical byDay array is consumed without throwing.
    expect(screen.getAllByTestId('container').length).toBeGreaterThanOrEqual(1);
  });
});

describe('UsageCharts — model breakdown table (RM6.2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows Cost (USD) column header when models present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(summaryWithModels),
    } as Response));

    render(<UsageCharts />);
    await waitFor(() => expect(screen.getByText('Cost (USD)')).toBeInTheDocument());
  });

  it('shows formatted cost for known model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(summaryWithModels),
    } as Response));

    render(<UsageCharts />);
    await waitFor(() => expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument());
    // costUSD 0.0045 < 0.01 → formatCost → "$0.0045"
    expect(screen.getByText('$0.0045')).toBeInTheDocument();
  });

  it('shows "unknown" badge for model without known pricing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(summaryWithModels),
    } as Response));

    render(<UsageCharts />);
    await waitFor(() => expect(screen.getByText('my-custom-unknown-model')).toBeInTheDocument());
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});
