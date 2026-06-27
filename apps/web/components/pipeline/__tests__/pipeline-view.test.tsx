import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PipelineView } from '../pipeline-view';

function makeProject() {
  return {
    id: 'p1', userId: 'user-1', name: 'Proj', description: 'd',
    currentStage: 'discovery', status: 'pending', metrics: { totalTokens: 0, phasesCompleted: 0 }, createdAt: '2024-01-01',
  };
}

describe('PipelineView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/phases')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [makeProject()] } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders header and create form', async () => {
    render(<PipelineView />);
    expect(screen.getByText('Pipeline Projects')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Pipeline' })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('Proj')).toBeInTheDocument());
  });

  it('loads projects', async () => {
    render(<PipelineView />);
    await waitFor(() => expect(screen.getByText('Proj')).toBeInTheDocument());
  });

  it('sends projectPath when creating a pipeline project', async () => {
    render(<PipelineView />);
    await userEvent.type(screen.getByPlaceholderText('Project name'), 'New pipeline');
    await userEvent.type(screen.getByPlaceholderText('Project path (e.g. /Users/me/my-repo)'), '/tmp/repo');
    await userEvent.click(screen.getByRole('button', { name: 'New Pipeline' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/pipeline/projects', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New pipeline', description: '', projectPath: '/tmp/repo' }),
      }));
    });
  });

  it('shows right panel placeholder when no selection', async () => {
    render(<PipelineView />);
    expect(screen.getByText(/select a pipeline project/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Proj')).toBeInTheDocument());
  });

  it('selects a project to view phases', async () => {
    render(<PipelineView />);
    await waitFor(() => expect(screen.getByText('Proj')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Proj'));
    expect((await screen.findAllByText('Discovery')).length).toBeGreaterThan(0);
  });

  it('links active phase runs to the dedicated run console', async () => {
    render(<PipelineView />);
    await waitFor(() => expect(screen.getByText('Proj')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Proj'));

    const runLink = await screen.findByRole('link', { name: 'Run' });
    expect(runLink).toHaveAttribute('href', '/pipeline/p1/run?stage=discovery');
  });
});
