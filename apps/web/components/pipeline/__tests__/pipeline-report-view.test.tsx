import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PipelineReportView } from '../pipeline-report-view';

describe('PipelineReportView (M5.6)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('fetches the report and renders it as a Markdown block', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ report: '# Project Phoenix\n\nDiscovery: complete' }),
    });
    render(<PipelineReportView projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText(/Project Phoenix/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/pipeline/projects/proj-1/report', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('shows an error block when the API returns non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    render(<PipelineReportView projectId="missing" />);
    await waitFor(() => expect(screen.getByText(/Failed: 404/)).toBeInTheDocument());
  });

  it('shows an error block when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    render(<PipelineReportView projectId="proj-2" />);
    await waitFor(() => expect(screen.getByText(/network down/)).toBeInTheDocument());
  });

  it('shows a loading indicator while the report is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    render(<PipelineReportView projectId="proj-3" />);
    expect(screen.getByText(/Generating report/)).toBeInTheDocument();
  });
});
