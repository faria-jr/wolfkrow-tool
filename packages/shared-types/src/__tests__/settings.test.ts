import { describe, expect, it } from 'vitest';

import {
  CompactionModelSchema,
  CompactionSettingsSchema,
  OrchestratorConfigSchema,
  SettingsSchema,
  STTProviderSchema,
  STTSettingsSchema,
  UpdateSettingsInputSchema,
  VoiceProviderSchema,
  VoiceSettingsSchema,
} from '../schemas/settings';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('settings schemas', () => {
  describe('enums', () => {
    it.each(['elevenlabs', 'cartesia'] as const)(
      'VoiceProviderSchema accepts %s',
      (v) => {
        expect(VoiceProviderSchema.parse(v)).toBe(v);
      },
    );
    it('VoiceProviderSchema rejects invalid', () => {
      expect(() => VoiceProviderSchema.parse('nope')).toThrow();
    });

    it.each(['whisper-local', 'openai-whisper'] as const)(
      'STTProviderSchema accepts %s',
      (v) => {
        expect(STTProviderSchema.parse(v)).toBe(v);
      },
    );
    it('STTProviderSchema rejects invalid', () => {
      expect(() => STTProviderSchema.parse('nope')).toThrow();
    });

    it.each(['claude-haiku-3-5', 'claude-haiku-4', 'gemini-flash'] as const)(
      'CompactionModelSchema accepts %s',
      (v) => {
        expect(CompactionModelSchema.parse(v)).toBe(v);
      },
    );
    it('CompactionModelSchema rejects invalid', () => {
      expect(() => CompactionModelSchema.parse('nope')).toThrow();
    });
  });

  describe('VoiceSettingsSchema', () => {
    it('applies defaults', () => {
      const parsed = VoiceSettingsSchema.parse({
        provider: 'elevenlabs',
        voiceId: 'v1',
      });
      expect(parsed.speed).toBe(1);
      expect(parsed.stability).toBe(0.5);
      expect(parsed.similarityBoost).toBe(0.5);
    });
    it('rejects speed out of [0.5, 2]', () => {
      expect(() =>
        VoiceSettingsSchema.parse({ provider: 'elevenlabs', voiceId: 'v1', speed: 3 }),
      ).toThrow();
    });
    it('rejects invalid provider', () => {
      expect(() =>
        VoiceSettingsSchema.parse({ provider: 'nope', voiceId: 'v1' }),
      ).toThrow();
    });
  });

  describe('STTSettingsSchema', () => {
    it('applies defaults', () => {
      const parsed = STTSettingsSchema.parse({ provider: 'whisper-local' });
      expect(parsed.model).toBe('whisper-1');
      expect(parsed.language).toBe('auto');
    });
    it('rejects invalid provider', () => {
      expect(() => STTSettingsSchema.parse({ provider: 'nope' })).toThrow();
    });
  });

  describe('OrchestratorConfigSchema', () => {
    it('applies defaults', () => {
      const parsed = OrchestratorConfigSchema.parse({
        sdk: 'claude-agent',
        model: 'claude-sonnet-4-6',
      });
      expect(parsed.effort).toBe('medium');
      expect(parsed.thinking).toBe(false);
    });
    it.each(['claude-agent', 'claude-compat', 'codex', 'lion'] as const)(
      'accepts sdk %s',
      (sdk) => {
        expect(() =>
          OrchestratorConfigSchema.parse({ sdk, model: 'm' }),
        ).not.toThrow();
      },
    );
    it('rejects invalid sdk', () => {
      expect(() =>
        OrchestratorConfigSchema.parse({ sdk: 'nope', model: 'm' }),
      ).toThrow();
    });
    it('rejects empty model', () => {
      expect(() =>
        OrchestratorConfigSchema.parse({ sdk: 'codex', model: '' }),
      ).toThrow();
    });
  });

  describe('CompactionSettingsSchema', () => {
    it('applies defaults', () => {
      const parsed = CompactionSettingsSchema.parse({});
      expect(parsed.enabled).toBe(true);
      expect(parsed.trigger).toBe('token_threshold');
      expect(parsed.tokenThreshold).toBe(150_000);
      expect(parsed.model).toBe('claude-haiku-4');
      expect(parsed.preserveLastMessages).toBe(10);
    });
    it('rejects non-positive tokenThreshold', () => {
      expect(() =>
        CompactionSettingsSchema.parse({ tokenThreshold: 0 }),
      ).toThrow();
    });
  });

  describe('SettingsSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      orchestrator: { sdk: 'claude-agent' as const, model: 'm' },
      compaction: {},
      metadata: {},
      updatedAt: ts,
    };
    it('accepts valid settings and applies defaults', () => {
      const parsed = SettingsSchema.parse(valid);
      expect(parsed.theme).toBe('system');
      expect(parsed.telemetry).toBe(false);
      expect(parsed.autoLaunch).toBe(false);
      expect(parsed.autoLockMinutes).toBe(5);
    });
    it('accepts optional voice / stt', () => {
      expect(() =>
        SettingsSchema.parse({
          ...valid,
          voice: { provider: 'elevenlabs', voiceId: 'v1' },
          stt: { provider: 'whisper-local' },
        }),
      ).not.toThrow();
    });
    it('rejects missing compaction (required)', () => {
      const { compaction: _omit, ...rest } = valid;
      expect(() => SettingsSchema.parse(rest)).toThrow();
    });
    it('rejects non-uuid id', () => {
      expect(() => SettingsSchema.parse({ ...valid, id: 'x' })).toThrow();
    });
  });

  describe('UpdateSettingsInputSchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(UpdateSettingsInputSchema.parse({})).toEqual({});
    });
    it('rejects bad theme when provided', () => {
      expect(() => UpdateSettingsInputSchema.parse({ theme: 'nope' })).toThrow();
    });
  });
});
