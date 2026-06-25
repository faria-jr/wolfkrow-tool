import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { ProviderList } from '@/components/settings/provider-config/provider-list';
import { SettingsShell } from '@/components/settings/settings-shell';

export const metadata = { title: 'Provider Configuration' };

export default function ProvidersSettingsPage() {
  return (
    <SettingsShell>
      <PageShell variant="narrow">
        <PageHeader title="Providers" description="LLM providers and API configuration." />
        <PageContent>
          <ProviderList />
        </PageContent>
      </PageShell>
    </SettingsShell>
  );
}
