import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AudioPlayer } from '../audio-player';

describe('AudioPlayer', () => {
  it('renders nothing when no src', () => {
    const { container } = render(<AudioPlayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders play button and audio element when src provided', () => {
    render(<AudioPlayer src="/audio.mp3" />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(document.querySelector('audio')).toBeInTheDocument();
  });

  it('reflects autoplay prop without crashing', () => {
    render(<AudioPlayer src="/audio.mp3" autoPlay onEnded={() => {}} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});
