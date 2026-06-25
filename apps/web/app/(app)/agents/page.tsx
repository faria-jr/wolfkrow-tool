import { Bot } from 'lucide-react';
import type { Metadata } from 'next';

import { AgentsView } from '@/components/agents/agents-view';
import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';

export const metadata: Metadata = {
  title: 'Agents',
  description: 'Manage AI agents',
};

export default function AgentsPage() {
  return (
    <PageShell>
      <PageHeader title="Agents" description="Configure AI personas" icon={<Bot className="h-6 w-6" />} />
      <PageContent>
        <AgentsView />
      </PageContent>
    </PageShell>
  );
}
