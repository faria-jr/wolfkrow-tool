import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TasksCalendar } from '../tasks-calendar';

const mockTasks = [
  {
    id: '1',
    title: 'Task with due date',
    status: 'todo',
    priority: 'high',
    category: 'work',
    tags: [],
    dueDate: '2024-06-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'No date task',
    status: 'todo',
    priority: 'low',
    category: 'work',
    tags: [],
    dueDate: null,
  },
];

describe('TasksCalendar', () => {
  it('renders day-of-week headers', () => {
    render(<TasksCalendar tasks={mockTasks} year={2024} month={6} />);
    expect(screen.getByText('Sun')).toBeDefined();
    expect(screen.getByText('Mon')).toBeDefined();
    expect(screen.getByText('Sat')).toBeDefined();
  });

  it('renders task title on its due date cell', () => {
    render(<TasksCalendar tasks={mockTasks} year={2024} month={6} />);
    expect(screen.getByText('Task with due date')).toBeDefined();
  });

  it('does not render tasks without due date', () => {
    render(<TasksCalendar tasks={mockTasks} year={2024} month={6} />);
    expect(screen.queryByText('No date task')).toBeNull();
  });
});
