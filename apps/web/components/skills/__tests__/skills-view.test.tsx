import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillsView } from '../skills-view';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

function makeSkill() {
  return {
    id: 'sk1',
    userId: 'u1',
    name: 'My Skill',
    description: 'does things',
    content: 'body',
    tags: ['x'],
    version: '1.0.0',
    author: undefined,
    isBuiltIn: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

describe('SkillsView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skills: [makeSkill()] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders New skill button', async () => {
    render(<SkillsView />);
    expect(screen.getByRole('button', { name: /new skill/i })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('My Skill')).toBeInTheDocument());
  });

  it('navigates to the dedicated edit screen when editing a skill', async () => {
    render(<SkillsView />);
    await waitFor(() => expect(screen.getByText('My Skill')).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText('Edit skill'));

    expect(push).toHaveBeenCalledWith('/skills/sk1/edit');
  });

  it('navigates to the dedicated create screen from New skill', async () => {
    render(<SkillsView />);
    await waitFor(() => expect(screen.getByText('My Skill')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /new skill/i }));

    expect(push).toHaveBeenCalledWith('/skills/new');
  });

  it('duplicates a skill from the table action', async () => {
    render(<SkillsView />);
    await waitFor(() => expect(screen.getByText('My Skill')).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText('Duplicate skill'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/skills',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows error state when fetch fails and allows retry', async () => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server error' }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
    render(<SkillsView />);
    await waitFor(() => expect(screen.getByText(/failed to load skills/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
