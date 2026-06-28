import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-stt', () => ({
  useStt: vi.fn(() => ({
    isRecording: false,
    transcript: '',
    startRecording: vi.fn(),
    stopRecording: vi.fn().mockResolvedValue('hello'),
    reset: vi.fn(),
    error: null,
  })),
}));

import { VoiceRecorder } from '../voice-recorder';

import { useStt } from '@/hooks/use-stt';

describe('VoiceRecorder', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders start button by default', () => {
    render(<VoiceRecorder />);
    expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
  });

  it('clicking start calls startRecording', async () => {
    const startRecording = vi.fn();
    vi.mocked(useStt).mockReturnValue({
      isRecording: false,
      transcript: '',
      startRecording,
      stopRecording: vi.fn(),
      reset: vi.fn(),
      error: null,
    });
    render(<VoiceRecorder />);
    await userEvent.click(screen.getByRole('button'));
    expect(startRecording).toHaveBeenCalled();
  });

  it('shows transcript when present', () => {
    vi.mocked(useStt).mockReturnValue({
      isRecording: false,
      transcript: 'recognized text',
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      reset: vi.fn(),
      error: null,
    });
    render(<VoiceRecorder />);
    expect(screen.getByText('recognized text')).toBeInTheDocument();
  });

  it('shows stop button while recording and calls onTranscript', async () => {
    const onTranscript = vi.fn();
    const stopRecording = vi.fn().mockResolvedValue('final text');
    vi.mocked(useStt).mockReturnValue({
      isRecording: true,
      transcript: '',
      startRecording: vi.fn(),
      stopRecording,
      reset: vi.fn(),
      error: null,
    });
    render(<VoiceRecorder onTranscript={onTranscript} />);
    await userEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(stopRecording).toHaveBeenCalled();
  });
});
