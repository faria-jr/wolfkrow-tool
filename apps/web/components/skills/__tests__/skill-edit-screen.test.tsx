import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillEditScreen } from '../skill-edit-screen';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

const skillFixture = {
  id: 's-1',
  userId: 'u-1',
  name: 'pdf',
  description: 'PDF processing',
  content: '# PDF\n\nUse OCR.',
  tags: ['docs'],
  version: '1.0.0',
  author: undefined,
  isBuiltIn: false,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function mockJsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function setupFetch(opts: { notFound?: boolean } = {}) {
  const calls: Array<[string, RequestInit | undefined]> = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push([url, init]);
    if (opts.notFound) return mockJsonResponse({ error: 'Skill not found' }, 404);
    if (url.includes('/api/skills/') && (init?.method ?? 'GET') === 'GET')
      return mockJsonResponse({ skill: skillFixture });
    if (url.includes('/api/skills/') && init?.method === 'PUT')
      return mockJsonResponse({ skill: skillFixture });
    return mockJsonResponse({});
  }) as unknown as typeof fetch;
  return calls;
}

describe('SkillEditScreen (EPIC 1.2)', () => {
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  it('loads skill data into the dedicated markdown edit screen', async () => {
    setupFetch();
    render(<SkillEditScreen skillId="s-1" />);

    expect(screen.getByText(/loading skill/i)).toBeInTheDocument();
    await waitFor(() => {
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('pdf');
    });
    expect((screen.getByLabelText(/skill content/i) as HTMLTextAreaElement).value).toContain(
      'Use OCR'
    );
  });

  it('saves changes with PUT and returns to skills list', async () => {
    const calls = setupFetch();
    render(<SkillEditScreen skillId="s-1" />);
    await waitFor(() =>
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('pdf')
    );

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const putCall = calls.find(
        ([url, init]) => url === '/api/skills/s-1' && init?.method === 'PUT'
      );
      expect(putCall).toBeTruthy();
    });
    expect(push).toHaveBeenCalledWith('/skills');
  });

  it('shows an error state when the skill cannot be loaded', async () => {
    setupFetch({ notFound: true });
    render(<SkillEditScreen skillId="missing" />);

    await waitFor(() => expect(screen.getByText(/could not load skill/i)).toBeInTheDocument());
    expect(screen.getByText(/skill not found/i)).toBeInTheDocument();
  });
});
