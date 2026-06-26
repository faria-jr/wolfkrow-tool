import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardView } from '../dashboard-view';

let originalFetch: typeof globalThis.fetch;

function mockFetch(harness: unknown[], pipeline: unknown[]) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = url.includes('/api/harness/projects') ? harness : pipeline;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  originalFetch = global.fetch;
  mockFetch(harnessProjects, pipelineProjects);
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const harnessProjects = [
  {
    id: 'h1', name: 'Harness A', status: 'running', createdAt: '2026-06-25T10:00:00.000Z',
    metrics: { totalTokens: 1200, totalCost: 0.5, roundCount: 3, featuresPassed: 1, featuresTotal: 2, totalDurationMs: 60000 },
  },
  {
    id: 'h2', name: 'Harness B', status: 'completed', createdAt: '2026-06-24T10:00:00.000Z',
    metrics: { totalTokens: 800, totalCost: 0.25, roundCount: 2, featuresPassed: 2, featuresTotal: 2, totalDurationMs: 30000 },
  },
];

const pipelineProjects = [
  { id: 'p1', name: 'Pipeline A', status: 'active', currentStage: 'implementation', createdAt: '2026-06-25T12:00:00.000Z' },
];

describe('DashboardView', () => {
  it('renders KPIs derived from harness + pipeline data', async () => {
    render(<DashboardView />);
    await waitFor(() => expect(screen.getByText('Harness A')).toBeInTheDocument());

    // Tokens = 1200 + 800 = 2000; Cost = 0.5 + 0.25 = 0.75; Projects = 3.
    expect(screen.getByText('2,000')).toBeInTheDocument();
    expect(screen.getByText('$0.7500')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('lists recent runs across harness + pipeline, newest first', async () => {
    render(<DashboardView />);
    await waitFor(() => expect(screen.getByText('Pipeline A')).toBeInTheDocument());
    expect(screen.getByText('Harness A')).toBeInTheDocument();
    expect(screen.getByText('Harness B')).toBeInTheDocument();
  });

  it('exposes quick-action links', async () => {
    render(<DashboardView />);
    await waitFor(() => expect(screen.getByText('Harness A')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /new chat/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new pipeline/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /run audit/i })).toBeInTheDocument();
  });
});
