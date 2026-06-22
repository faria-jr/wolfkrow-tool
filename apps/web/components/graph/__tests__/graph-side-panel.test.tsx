import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GraphSidePanel } from '../GraphSidePanel';
import type { GraphNode } from '../types';

const node: GraphNode = {
  id: 'n1', userId: 'u1', label: 'React', type: 'concept', sourceId: 'src-1', createdAt: '2024-01-01T00:00:00Z',
};

describe('GraphSidePanel', () => {
  it('renders placeholder when no node selected', () => {
    render(<GraphSidePanel selected={null} neighborhood={null} />);
    expect(screen.getByText(/select a node to inspect/i)).toBeInTheDocument();
  });

  it('renders node details when selected', () => {
    render(<GraphSidePanel selected={node} neighborhood={null} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Concept')).toBeInTheDocument();
    expect(screen.getByText(/no connections/i)).toBeInTheDocument();
  });

  it('renders neighbors', () => {
    const neighbor: GraphNode = { id: 'n2', userId: 'u1', label: 'TypeScript', type: 'concept', sourceId: 's', createdAt: '2024-01-01T00:00:00Z' };
    render(<GraphSidePanel selected={node} neighborhood={{ center: node, neighbors: [neighbor], edges: [] }} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Connections (1)')).toBeInTheDocument();
  });

  it('fires onDelete when delete button clicked', async () => {
    const onDelete = vi.fn();
    render(<GraphSidePanel selected={node} neighborhood={null} onDelete={onDelete} />);
    await userEvent.click(screen.getByLabelText('Delete node'));
    expect(onDelete).toHaveBeenCalledWith(node);
  });
});
