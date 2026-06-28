import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BootstrappingView } from '../bootstrapping-view';

describe('BootstrappingView', () => {
  it('renders all bootstrap stages', () => {
    render(<BootstrappingView stage="run-dir" />);
    expect(screen.getByText('Preparing session folder')).toBeInTheDocument();
    expect(screen.getByText('Opening Open Design')).toBeInTheDocument();
  });

  it('highlights the current stage and marks earlier ones as done', () => {
    const { container } = render(<BootstrappingView stage="od-project" />);
    // The current stage (by label) is marked aria-current="step".
    expect(screen.getByText('Creating Open Design project').closest('li')).toHaveAttribute(
      'aria-current',
      'step'
    );
    // An earlier stage shows a "done" status badge.
    expect(screen.getAllByText('done').length).toBeGreaterThan(0);
    // The running stage shows a "running" status badge.
    expect(screen.getAllByText('running').length).toBe(1);
    // Snapshot length sanity: 9 steps rendered.
    expect(container.querySelectorAll('li')).toHaveLength(9);
  });

  it('renders an error message when provided', () => {
    render(<BootstrappingView stage="sidecar" error="Sidecar failed to start" />);
    expect(screen.getByText('Sidecar failed to start')).toBeInTheDocument();
  });

  it('marks all stages pending when stage is empty', () => {
    render(<BootstrappingView stage="" />);
    expect(screen.getAllByText('pending').length).toBe(9);
  });
});
