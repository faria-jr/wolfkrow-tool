import { ArrowLeft, Bot } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AgentEditScreen } from '@/components/agents/agent-edit-screen';
import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Edit agent',
  description: 'Edit an AI agent',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentEditPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <PageShell>
      <PageHeader
        title="Edit agent"
        description="Update the agent's prompt, model, tools, and runtime."
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
        <AgentEditScreen agentId={id} />
      </PageContent>
    </PageShell>
  );
}
