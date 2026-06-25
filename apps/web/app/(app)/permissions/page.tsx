import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { PermissionsView } from '@/components/permissions/permissions-view';

export const metadata: Metadata = {
  title: 'Permissions',
  description: 'Manage per-agent tool permissions',
};

export default function PermissionsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Permissions"
        description="Manage allow/deny/ask per agent and tool"
        icon={<ShieldCheck className="h-6 w-6" />}
      />
      <PageContent>
        <PermissionsView />
      </PageContent>
    </PageShell>
  );
}
