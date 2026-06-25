'use client';

import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useVoiceSettings } from '@/hooks/use-voice-settings';

const TTS_PROVIDERS = [
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'cartesia', label: 'Cartesia' },
] as const;

const STT_PROVIDERS = [
  { value: 'openai-whisper', label: 'OpenAI Whisper (cloud)' },
  { value: 'whisper-local', label: 'Whisper (local)' },
] as const;

function fieldClass() {
  return 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';
}

interface SectionProps {
  idBase: string;
  settings: ReturnType<typeof useVoiceSettings>['settings'];
  update: ReturnType<typeof useVoiceSettings>['update'];
}

function SttSection({ idBase, settings, update }: SectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Speech-to-text (STT)</h3>
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-stt`}>STT engine</Label>
        <Select
          value={settings.sttProvider}
          onValueChange={(v) => update({ sttProvider: v as typeof settings.sttProvider })}
        >
          <SelectTrigger id={`${idBase}-stt`} data-testid="stt-provider-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STT_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}

function TtsProviderSection({ idBase, settings, update }: SectionProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`${idBase}-tts`}>TTS provider</Label>
      <Select
        value={settings.provider}
        onValueChange={(v) => update({ provider: v as typeof settings.provider })}
      >
        <SelectTrigger id={`${idBase}-tts`} data-testid="tts-provider-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TTS_PROVIDERS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TtsTuningSection({ idBase, settings, update }: SectionProps) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-voice`}>Voice ID</Label>
        <input
          id={`${idBase}-voice`}
          type="text"
          value={settings.voiceId}
          onChange={(e) => update({ voiceId: e.target.value })}
          placeholder="Provider voice id (optional)"
          className={fieldClass()}
          data-testid="voice-id-input"
        />
      </div>
      <SliderField id={`${idBase}-speed`} label={`Speed: ${settings.speed.toFixed(2)}x`} value={settings.speed} onChange={(v) => update({ speed: v })} min={0.5} max={2} testId="speed-slider" />
      <SliderField id={`${idBase}-stability`} label={`Stability: ${settings.stability.toFixed(2)}`} value={settings.stability} onChange={(v) => update({ stability: v })} />
      <SliderField id={`${idBase}-sim`} label={`Similarity boost: ${settings.similarityBoost.toFixed(2)}`} value={settings.similarityBoost} onChange={(v) => update({ similarityBoost: v })} />
    </>
  );
}

interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  testId?: string;
  onChange: (v: number) => void;
}

function SliderField({ id, label, value, min = 0, max = 1, testId, onChange }: SliderFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Slider
        id={id}
        min={min}
        max={max}
        step={0.05}
        value={[value]}
        onValueChange={([v]) => { if (v !== undefined) onChange(v); }}
        {...(testId !== undefined ? { 'data-testid': testId } : {})}
      />
    </div>
  );
}

/**
 * Voice settings section — STT engine + TTS provider selection.
 * Controls mirror the canonical VoiceSettings/STTSettings schemas (shared-types).
 */
export function VoiceSettingsPanel() {
  const { settings, update, reset } = useVoiceSettings();
  const id = useId();
  const sectionProps: SectionProps = { idBase: id, settings, update };
  return (
    <div className="space-y-6" data-testid="voice-settings-panel">
      <SttSection {...sectionProps} />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Text-to-speech (TTS)</h3>
        <TtsProviderSection {...sectionProps} />
        <TtsTuningSection {...sectionProps} />
      </section>
      <Button variant="outline" onClick={reset} data-testid="reset-voice-btn">
        Reset to defaults
      </Button>
    </div>
  );
}
