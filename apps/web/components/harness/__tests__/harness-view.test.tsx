import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HarnessView } from '../harness-view';

function makeProject(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    userId: 'user-1',
    name: 'Project Alpha',
    description: 'desc',
    specPath: '/spec.md',
    status: 'planning',
    config: { maxRoundsPerFeature: 5, coderModel: 'm', plannerModel: 'm' },
    metrics: {
      totalTokens: 100,
      totalCost: 1,
      roundCount: 0,
      featuresPassed: 0,
      featuresTotal: 0,
      totalDurationMs: 0,
    },
    createdAt: '2024-01-01',
    ...overrides,
  };
}

function makeSprint() {
  return {
    id: 's1',
    projectId: 'p1',
    number: 1,
    name: 'Foundations',
    status: 'planned',
    features: [{ name: 'Login', description: 'Auth flow', acceptanceCriteria: ['works'] }],
  };
}

describe('HarnessView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/plan')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      if (url.includes('/rounds')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      if (url.includes('/sprints')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [makeProject()] } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders header and create form', async () => {
    render(<HarnessView />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('Project Alpha')).toBeInTheDocument());
  });

  it('lists loaded projects', async () => {
    render(<HarnessView />);
    await waitFor(() => expect(screen.getByText('Project Alpha')).toBeInTheDocument());
  });

  it('selects a project and shows sprint panel', async () => {
    render(<HarnessView />);
    await waitFor(() => expect(screen.getByText('Project Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Project Alpha'));
    expect(await screen.findByText(/Features passed/i)).toBeInTheDocument();
  });

  it('links sprint runs to the dedicated run console', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/rounds')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      if (url.includes('/sprints')) {
        return Promise.resolve({ ok: true, json: async () => [makeSprint()] } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [makeProject()] } as Response);
    });

    render(<HarnessView />);
    await waitFor(() => expect(screen.getByText('Project Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Project Alpha'));

    const runLink = await screen.findByRole('link', { name: 'Run' });
    expect(runLink).toHaveAttribute('href', '/harness/p1/run?sprintId=s1');
  });
});
