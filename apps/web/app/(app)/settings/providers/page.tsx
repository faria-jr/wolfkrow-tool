import { PageHeader } from '@/components/common/page-header';
import { ProviderList } from '@/components/settings/provider-config/provider-list';
import { SettingsShell } from '@/components/settings/settings-shell';

export const metadata = { title: 'Provider Configuration' };

export default function ProvidersSettingsPage() {
  return (
    <SettingsShell>
      <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
        <PageHeader title="Providers" description="LLM providers and API configuration." />
        <div className="flex-1 overflow-auto">
          <ProviderList />
        </div>
      </div>
    </SettingsShell>
  );
}
