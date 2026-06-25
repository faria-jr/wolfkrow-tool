import { describe, expect, it } from 'vitest';

import {
  STTRequestSchema,
  STTResponseSchema,
  TTSRequestSchema,
  VoiceSessionSchema,
  VoiceSessionStatusSchema,
} from '../schemas/voice';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('voice schemas', () => {
  describe('VoiceSessionStatusSchema', () => {
    it.each(['idle', 'listening', 'processing', 'speaking', 'thinking', 'error', 'ended'] as const)(
      'accepts %s',
      (v) => {
        expect(VoiceSessionStatusSchema.parse(v)).toBe(v);
      },
    );
    it('rejects invalid', () => {
      expect(() => VoiceSessionStatusSchema.parse('nope')).toThrow();
    });
  });

  describe('VoiceSessionSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      metadata: {},
    };
    it('accepts a valid session and applies defaults', () => {
      const parsed = VoiceSessionSchema.parse(valid);
      expect(parsed.status).toBe('idle');
      expect(parsed.totalDurationMs).toBe(0);
      expect(parsed.turnCount).toBe(0);
      expect(parsed.bargeInCount).toBe(0);
    });
    it('accepts optional chatSessionId / providers / timestamps', () => {
      expect(() =>
        VoiceSessionSchema.parse({
          ...valid,
          chatSessionId: uuid,
          sttProvider: 'whisper-local',
          ttsProvider: 'elevenlabs',
          ttsVoiceId: 'v1',
          startedAt: '2024-01-01T00:00:00Z',
          endedAt: '2024-01-01T00:01:00Z',
        }),
      ).not.toThrow();
    });
    it('rejects non-uuid id', () => {
      expect(() => VoiceSessionSchema.parse({ ...valid, id: 'x' })).toThrow();
    });
    it('rejects invalid sttProvider', () => {
      expect(() =>
        VoiceSessionSchema.parse({ ...valid, sttProvider: 'nope' }),
      ).toThrow();
    });
  });

  describe('STTRequestSchema', () => {
    it('accepts a Buffer and applies default language', () => {
      const parsed = STTRequestSchema.parse({ audio: Buffer.from([1, 2, 3]) });
      expect(parsed.language).toBe('auto');
    });
    it('accepts a Uint8Array', () => {
      expect(() =>
        STTRequestSchema.parse({ audio: new Uint8Array([1, 2]) }),
      ).not.toThrow();
    });
    it('rejects a non-Buffer/non-Uint8Array audio', () => {
      expect(() => STTRequestSchema.parse({ audio: 'not-a-buffer' })).toThrow();
    });
    it('rejects missing audio', () => {
      expect(() => STTRequestSchema.parse({})).toThrow();
    });
  });

  describe('STTResponseSchema', () => {
    it('accepts a valid response', () => {
      expect(() =>
        STTResponseSchema.parse({ text: 'hello' }),
      ).not.toThrow();
    });
    it('accepts optional language / durationMs', () => {
      expect(() =>
        STTResponseSchema.parse({ text: 'hi', language: 'en', durationMs: 100 }),
      ).not.toThrow();
    });
    it('rejects missing text', () => {
      expect(() => STTResponseSchema.parse({})).toThrow();
    });
  });

  describe('TTSRequestSchema', () => {
    it('accepts a valid request and applies default speed', () => {
      const parsed = TTSRequestSchema.parse({ text: 'hello', voiceId: 'v1' });
      expect(parsed.speed).toBe(1);
    });
    it('rejects empty text', () => {
      expect(() =>
        TTSRequestSchema.parse({ text: '', voiceId: 'v1' }),
      ).toThrow();
    });
    it('rejects text over 10k chars', () => {
      expect(() =>
        TTSRequestSchema.parse({ text: 'a'.repeat(10_001), voiceId: 'v1' }),
      ).toThrow();
    });
    it('rejects speed out of [0.5, 2]', () => {
      expect(() =>
        TTSRequestSchema.parse({ text: 'hi', voiceId: 'v1', speed: 3 }),
      ).toThrow();
    });
    it('rejects missing voiceId', () => {
      expect(() => TTSRequestSchema.parse({ text: 'hi' })).toThrow();
    });
  });
});
