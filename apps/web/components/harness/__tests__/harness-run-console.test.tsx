import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HarnessRunConsole } from '../harness-run-console';

vi.mock('../execution-view', () => ({
  ExecutionView: ({ sprintName, features }: { sprintName: string; features: unknown[] }) => (
    <div>
      Execution console for {sprintName} with {features.length} feature
    </div>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeProject() {
  return {
    id: 'p1',
    name: 'Project Alpha',
    status: 'planning',
    projectPath: '/tmp/repo',
    metrics: {
      totalTokens: 0,
      totalCost: 0,
      roundCount: 0,
      featuresPassed: 0,
      featuresTotal: 0,
      totalDurationMs: 0,
    },
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

describe('HarnessRunConsole', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/sprints')) {
          return Promise.resolve({ ok: true, json: async () => [makeSprint()] } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => makeProject() } as Response);
      })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the requested sprint into the dedicated execution console', async () => {
    render(<HarnessRunConsole projectId="p1" sprintId="s1" />);

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Path: /tmp/repo')).toBeInTheDocument();
    expect(
      screen.getByText('Execution console for Foundations with 1 feature')
    ).toBeInTheDocument();
  });
});
