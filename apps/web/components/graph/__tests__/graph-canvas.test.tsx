import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('d3', () => ({
  select: vi.fn(() => ({
    attr: vi.fn().mockReturnThis(),
    append: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    call: vi.fn().mockReturnThis(),
    style: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    data: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    node: vi.fn(() => ({})),
  })),
  forceSimulation: vi.fn(() => ({
    force: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    alphaTarget: vi.fn().mockReturnThis(),
    restart: vi.fn().mockReturnThis(),
  })),
  forceManyBody: vi.fn(() => ({ strength: vi.fn() })),
  forceLink: vi.fn(() => ({ id: vi.fn().mockReturnThis(), distance: vi.fn() })),
  forceCenter: vi.fn(),
  forceCollide: vi.fn(() => ({ radius: vi.fn().mockReturnThis() })),
  drag: vi.fn(() => ({ on: vi.fn().mockReturnThis() })),
  zoom: vi.fn(() => ({ scaleExtent: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis() })),
}));

import { GraphCanvas } from '../GraphCanvas';

describe('GraphCanvas', () => {
  it('renders the svg element with aria label', () => {
    render(<GraphCanvas nodes={[]} edges={[]} onSelect={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Knowledge graph' })).toBeInTheDocument();
  });
});
