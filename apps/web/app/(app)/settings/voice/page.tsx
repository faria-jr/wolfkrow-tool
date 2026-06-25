import { PageHeader } from '@/components/common/page-header';
import { SettingsShell } from '@/components/settings/settings-shell';
import { VoiceSettingsPanel } from '@/components/settings/voice-settings-panel';

export const metadata = { title: 'Voice Settings' };

export default function VoiceSettingsPage() {
  return (
    <SettingsShell>
      <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
        <PageHeader title="Voice" description="Configure speech-to-text and text-to-speech engines used by the chat voice orb." />
        <div className="flex-1 overflow-auto">
          <VoiceSettingsPanel />
        </div>
      </div>
    </SettingsShell>
  );
}
