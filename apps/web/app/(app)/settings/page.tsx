import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { SettingsView } from '@/components/settings/settings-view';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <PageShell variant="narrow">
      <PageHeader title="Settings" description="Configure your Wolfkrow workspace." />
      <PageContent>
        <SettingsView />
      </PageContent>
    </PageShell>
  );
}
