import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillCreateScreen } from '../skill-create-screen';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

function mockJsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('SkillCreateScreen (EPIC 1.2)', () => {
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  it('creates a skill from the dedicated markdown screen', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ skill: { id: 's-1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    render(<SkillCreateScreen />);

    await userEvent.type(screen.getByLabelText(/name/i), 'pdf');
    await userEvent.type(screen.getByLabelText(/description/i), 'PDF processing');
    await userEvent.type(screen.getByLabelText(/skill content/i), '# PDF');
    await userEvent.click(screen.getByRole('button', { name: /create skill/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/skills',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(push).toHaveBeenCalledWith('/skills');
  });
});
