import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuleEditScreen } from '../rule-edit-screen';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ruleFixture = {
  id: 'r1',
  userId: 'u1',
  kind: 'behavior',
  title: 'Always polite',
  body: 'be nice',
  enabled: true,
  sortOrder: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('RuleEditScreen (EPIC 1.3)', () => {
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  it('loads an existing rule into a dedicated markdown edit screen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ rules: [ruleFixture] })));

    render(<RuleEditScreen ruleId="r1" />);

    await waitFor(() => expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Always polite'));
    expect((screen.getByLabelText(/rule body/i) as HTMLTextAreaElement).value).toBe('be nice');
    expect(screen.getByRole('tab', { name: /preview/i })).toBeInTheDocument();
  });

  it('saves an existing rule with PATCH and returns to the list', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return response({ rule: ruleFixture });
      return response({ rules: [ruleFixture] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RuleEditScreen ruleId="r1" />);
    await waitFor(() => expect(screen.getByLabelText(/title/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/rules/r1', expect.objectContaining({ method: 'PATCH' }));
    });
    expect(push).toHaveBeenCalledWith('/rules');
  });

  it('creates a new rule with POST from the dedicated markdown screen', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ rule: ruleFixture }, 201));
    vi.stubGlobal('fetch', fetchMock);

    render(<RuleEditScreen />);
    await userEvent.type(screen.getByLabelText(/title/i), 'Always polite');
    await userEvent.type(screen.getByLabelText(/rule body/i), 'be nice');
    await userEvent.click(screen.getByRole('button', { name: /create rule/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/rules', expect.objectContaining({ method: 'POST' }));
    });
    expect(push).toHaveBeenCalledWith('/rules');
  });
});
