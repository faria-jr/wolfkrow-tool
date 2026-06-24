import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import AuditPage from '../page';

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const mockScan = {
  id: 'scan-1',
  projectPath: '/tmp/proj',
  status: 'completed',
  findingCount: 2,
  summary: { total: 2 },
  startedAt: new Date().toISOString(),
};

const mockFinding = {
  id: 'f1',
  scanId: 'scan-1',
  severity: 'critical' as const,
  dimension: 'secrets',
  file: 'src/x.ts',
  line: 10,
  message: 'Hardcoded secret',
  rule: 'hardcoded-secret',
  agentId: 'secrets-scanner',
};

describe('AuditPage', () => {
  it('renders page title', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    }) as unknown as typeof fetch);
    render(<AuditPage />, { wrapper: makeWrapper() });
    expect(screen.getByText('Security Audit')).toBeTruthy();
  });

  it('shows empty scans state when no scans returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    }) as unknown as typeof fetch);
    render(<AuditPage />, { wrapper: makeWrapper() });
    expect(await screen.findByText(/no scans yet/i)).toBeTruthy();
  });

  it('renders scans list when scans returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [mockScan],
    }) as unknown as typeof fetch);
    render(<AuditPage />, { wrapper: makeWrapper() });
    expect(await screen.findByText('/tmp/proj')).toBeTruthy();
    expect(screen.getByText(/completed · 2 findings/i)).toBeTruthy();
  });

  it('clicking View loads findings for the selected scan', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [mockScan] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ findings: [mockFinding] }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<AuditPage />, { wrapper: makeWrapper() });
    await screen.findByText('/tmp/proj');
    await user.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText(/Findings for/)).toBeTruthy();
      expect(screen.getByText('Hardcoded secret')).toBeTruthy();
    });
  });

  it('submits a new audit and updates the scan list', async () => {
    const user = userEvent.setup();
    const newScan = { ...mockScan, id: 'scan-2', projectPath: '/tmp/proj2' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => newScan })
      .mockResolvedValueOnce({ ok: true, json: async () => [newScan] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ findings: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<AuditPage />, { wrapper: makeWrapper() });
    await screen.findByText(/no scans yet/i);

    const input = screen.getByPlaceholderText(/\/path\/to\/project/i);
    await user.type(input, '/tmp/proj2');
    await user.click(screen.getByRole('button', { name: /run audit/i }));

    await waitFor(() => {
      expect(screen.getByText('/tmp/proj2')).toBeTruthy();
    });
  });
});