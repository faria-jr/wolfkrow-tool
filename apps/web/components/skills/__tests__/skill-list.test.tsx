import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SkillData } from '../skill-list';
import { SkillList } from '../skill-list';

const skill: SkillData = {
  id: 's1', userId: 'u', name: 'My Skill', description: 'desc', content: 'body',
  tags: ['x', 'y'], version: '1', author: undefined, isBuiltIn: false, createdAt: '2024-01-01', updatedAt: '2024-01-01',
};

describe('SkillList', () => {
  it('renders empty state when no skills', () => {
    render(<SkillList skills={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no skills yet/i)).toBeInTheDocument();
  });

  it('renders skill name and tags', () => {
    render(<SkillList skills={[skill]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('My Skill')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('y')).toBeInTheDocument();
  });

  it('hides edit/delete buttons for built-in skills', () => {
    render(<SkillList skills={[{ ...skill, isBuiltIn: true }]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('built-in')).toBeInTheDocument();
    expect(screen.queryByLabelText('Edit skill')).not.toBeInTheDocument();
  });
});
