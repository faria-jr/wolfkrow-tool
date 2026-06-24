import { ProviderList } from '@/components/settings/provider-config/provider-list';

export const metadata = { title: 'Provider Configuration' };

export default function ProvidersSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <ProviderList />
    </div>
  );
}
