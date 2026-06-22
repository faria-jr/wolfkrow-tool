import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VoiceOrb } from '../voice-orb';

describe('VoiceOrb', () => {
  it('renders idle state with aria label', () => {
    render(<VoiceOrb state="idle" />);
    expect(screen.getByRole('button', { name: /click to start voice conversation/i })).toBeInTheDocument();
  });

  it('renders listening aria label', () => {
    render(<VoiceOrb state="listening" />);
    expect(screen.getByRole('button', { name: /listening/i })).toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<VoiceOrb state="speaking" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders processing and speaking states', () => {
    const { rerender } = render(<VoiceOrb state="processing" />);
    expect(screen.getByRole('button', { name: /processing/i })).toBeInTheDocument();
    rerender(<VoiceOrb state="speaking" />);
    expect(screen.getByRole('button', { name: /assistant speaking/i })).toBeInTheDocument();
  });
});
