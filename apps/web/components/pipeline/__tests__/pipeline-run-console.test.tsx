import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PipelineRunConsole } from '../pipeline-run-console';

vi.mock('../phase-stream-view', () => ({
  PhaseStreamView: ({ projectId, phaseId, stage }: { projectId: string; phaseId: string; stage: string }) => (
    <div>Phase console {projectId} {phaseId} {stage}</div>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeProject() {
  return {
    id: 'p1',
    name: 'Proj',
    currentStage: 'discovery',
    status: 'pending',
    metrics: { totalTokens: 0, phasesCompleted: 0 },
  };
}

function makePhase() {
  return {
    id: 'ph1',
    projectId: 'p1',
    stage: 'discovery',
    status: 'pending',
    metrics: { tokens: 0, durationMs: 0 },
  };
}

describe('PipelineRunConsole', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/phases') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => makePhase() } as Response);
      }
      if (url.endsWith('/phases')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => makeProject() } as Response);
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates the requested stage phase and renders the dedicated stream console', async () => {
    render(<PipelineRunConsole projectId="p1" stage="discovery" />);

    expect(await screen.findByText('Proj')).toBeInTheDocument();
    expect(screen.getByText('Phase console p1 ph1 discovery')).toBeInTheDocument();
  });
});
