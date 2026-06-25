import { KeyRound } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { VaultView } from '@/components/vault/vault-view';

export default function VaultPage() {
  return (
    <PageShell>
      <PageHeader title="Vault" description="Encrypted API keys and secrets" icon={<KeyRound className="h-6 w-6" />} />
      <PageContent>
        <VaultView />
      </PageContent>
    </PageShell>
  );
}
