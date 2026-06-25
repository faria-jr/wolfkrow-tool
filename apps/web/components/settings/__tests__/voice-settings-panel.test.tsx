import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { VoiceSettingsPanel } from '../voice-settings-panel';

describe('VoiceSettingsPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders current TTS provider, STT provider, and voice id', () => {
    render(<VoiceSettingsPanel />);
    // Defaults: elevenlabs / openai-whisper / empty voice id
    expect(screen.getByTestId('tts-provider-select')).toHaveTextContent(/elevenlabs/i);
    expect(screen.getByTestId('stt-provider-select')).toHaveTextContent(/openai whisper/i);
    expect(screen.getByTestId('voice-id-input')).toHaveValue('');
  });

  it('persists voice id to localStorage on change', async () => {
    const user = userEvent.setup();
    render(<VoiceSettingsPanel />);
    const input = screen.getByTestId('voice-id-input');
    await user.type(input, 'voice-xyz');
    const raw = window.localStorage.getItem('wolfkrow.voice-settings.v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { voiceId: string };
    expect(parsed.voiceId).toBe('voice-xyz');
  });

  it('persists speed slider change', async () => {
    const user = userEvent.setup();
    render(<VoiceSettingsPanel />);
    // Radix slider — invoke keyboard on a thumb
    const slider = screen.getByTestId('speed-slider');
    const thumb = slider.querySelector('[role="slider"]') as HTMLElement;
    thumb.focus();
    await user.keyboard('{ArrowRight}');
    const raw = window.localStorage.getItem('wolfkrow.voice-settings.v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { speed: number };
    expect(parsed.speed).toBeGreaterThan(1);
  });

  it('reset restores default voice id', async () => {
    const user = userEvent.setup();
    render(<VoiceSettingsPanel />);
    const input = screen.getByTestId('voice-id-input');
    await user.type(input, 'temp-id');
    expect(input).toHaveValue('temp-id');
    await user.click(screen.getByTestId('reset-voice-btn'));
    expect(input).toHaveValue('');
  });
});
