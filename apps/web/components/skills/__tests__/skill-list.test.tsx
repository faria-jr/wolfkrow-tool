import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SkillData } from '../skill-list';
import { SkillList } from '../skill-list';

const skill: SkillData = {
  id: 's1',
  userId: 'u',
  name: 'My Skill',
  description: 'desc',
  content: 'body',
  tags: ['x', 'y'],
  version: '1',
  author: undefined,
  isBuiltIn: false,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

describe('SkillList', () => {
  it('renders empty state when no skills', () => {
    render(<SkillList skills={[]} onEdit={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no skills yet/i)).toBeInTheDocument();
  });

  it('renders skill name and tags', () => {
    render(
      <SkillList skills={[skill]} onEdit={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText('My Skill')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('y')).toBeInTheDocument();
  });

  it('renders skills in the shared table pattern and opens edit action', async () => {
    const onEdit = vi.fn();
    render(<SkillList skills={[skill]} onEdit={onEdit} onDuplicate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /tags/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Edit skill'));
    expect(onEdit).toHaveBeenCalledWith(skill);
  });

  it('exposes duplicate action for every skill row', async () => {
    const onDuplicate = vi.fn();
    render(
      <SkillList skills={[skill]} onEdit={vi.fn()} onDuplicate={onDuplicate} onDelete={vi.fn()} />
    );

    await userEvent.click(screen.getByLabelText('Duplicate skill'));

    expect(onDuplicate).toHaveBeenCalledWith(skill);
  });

  it('allows editing built-in skills via override but disables delete', () => {
    render(
      <SkillList
        skills={[{ ...skill, isBuiltIn: true }]}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('built-in')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit skill')).toBeInTheDocument();
    expect(screen.getByLabelText('Duplicate skill')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete skill')).toBeDisabled();
  });
});
