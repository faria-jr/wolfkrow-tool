import { Bot } from 'lucide-react';
import type { Metadata } from 'next';

import { AgentsView } from '@/components/agents/agents-view';
import { PageHeader } from '@/components/common/page-header';

export const metadata: Metadata = {
  title: 'Agents',
  description: 'Manage AI agents',
};

export default function AgentsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Agents" description="Configure AI personas" icon={<Bot className="h-6 w-6" />} />
      <main className="flex-1 overflow-auto p-6">
        <AgentsView />
      </main>
    </div>
  );
}
