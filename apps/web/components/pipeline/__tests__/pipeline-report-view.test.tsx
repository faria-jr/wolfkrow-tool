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

  it('fetches the report and renders it as structured Markdown (heading/list/code), not a <pre> blob', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        report: '# Project Phoenix\n\nDiscovery: complete\n\n- Item one\n- Item two\n\n```ts\nconst x = 1;\n```',
      }),
    });
    const { container } = render(<PipelineReportView projectId="proj-1" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Project Phoenix/ })).toBeInTheDocument());
    // Heading rendered as <h1>, not escaped inside a single <pre>
    expect(container.querySelector('h1')).not.toBeNull();
    // List rendered as <ul>
    expect(container.querySelector('ul')).not.toBeNull();
    expect(screen.getByText('Item one')).toBeInTheDocument();
    // Code block rendered as <pre><code>
    expect(container.querySelector('pre > code')).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/pipeline/projects/proj-1/report', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('sanitizes raw HTML in the report (no script/img element rendered)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        report: '# Report\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>',
      }),
    });
    const { container } = render(<PipelineReportView projectId="proj-sec" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Report/ })).toBeInTheDocument());
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
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
