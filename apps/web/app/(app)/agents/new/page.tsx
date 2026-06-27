import { ArrowLeft, Bot } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AgentNewScreen } from '@/components/agents/agent-new-screen';
import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'New agent',
  description: 'Create a new AI agent',
};

export default function AgentNewPage() {
  return (
    <PageShell>
      <PageHeader
        title="New agent"
        description="Configure the agent's prompt, model, tools, and runtime."
        icon={<Bot className="h-6 w-6" />}
        actions={
          <Button asChild variant="outline">
            <Link href="/agents">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to agents
            </Link>
          </Button>
        }
      />
      <PageContent>
        <AgentNewScreen />
      </PageContent>
    </PageShell>
  );
}
