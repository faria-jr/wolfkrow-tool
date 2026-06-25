import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { VoiceSettingsPanel } from '@/components/settings/voice-settings-panel';

export const metadata = { title: 'Voice Settings' };

export default function VoiceSettingsPage() {
  return (
    <SettingsShell>
      <PageShell variant="narrow">
        <PageHeader title="Voice" description="Configure speech-to-text and text-to-speech engines used by the chat voice orb." />
        <PageContent>
          <VoiceSettingsPanel />
        </PageContent>
      </PageShell>
    </SettingsShell>
  );
}
