import { ArrowLeft, GitBranch } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { PipelineRunConsole } from '@/components/pipeline/pipeline-run-console';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Pipeline run' };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string; phaseId?: string; autoplay?: string }>;
}

export default async function PipelineRunPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { stage, phaseId, autoplay } = await searchParams;
  return (
    <PageShell>
      <PageHeader
        title="Pipeline run"
        description="Run and monitor a pipeline phase in a focused console."
        icon={<GitBranch className="h-6 w-6" />}
        actions={
          <Button asChild variant="outline">
            <Link href="/pipeline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to pipeline
            </Link>
          </Button>
        }
      />
      <PageContent>
        <PipelineRunConsole
          projectId={id}
          {...(stage ? { stage } : {})}
          {...(phaseId ? { phaseId } : {})}
          autoplay={autoplay === '1'}
        />
      </PageContent>
    </PageShell>
  );
}
