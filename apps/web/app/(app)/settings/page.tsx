import { PageHeader } from '@/components/common/page-header';
import { SettingsView } from '@/components/settings/settings-view';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-6">
      <PageHeader title="Settings" description="Configure your Wolfkrow workspace." />
      <div className="flex-1 overflow-auto">
        <SettingsView />
      </div>
    </div>
  );
}
