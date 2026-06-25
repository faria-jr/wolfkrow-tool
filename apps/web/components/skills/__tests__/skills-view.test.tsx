import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillsView } from '../skills-view';

function makeSkill() {
  return {
    id: 'sk1', userId: 'u1', name: 'My Skill', description: 'does things',
    content: 'body', tags: ['x'], version: '1.0.0', author: undefined,
    isBuiltIn: false, createdAt: '2024-01-01', updatedAt: '2024-01-01',
  };
}

describe('SkillsView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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

  it('loads skills and displays them', async () => {
    render(<SkillsView />);
    await waitFor(() => expect(screen.getByText('My Skill')).toBeInTheDocument());
  });
});
