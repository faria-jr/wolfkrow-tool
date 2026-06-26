import { ArrowLeft, Wrench } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { HarnessRunConsole } from '@/components/harness/harness-run-console';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Harness run' };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sprintId?: string }>;
}

export default async function HarnessRunPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sprintId } = await searchParams;
  return (
    <PageShell>
      <PageHeader
        title="Harness run"
        description="Monitor the Coder, Smoke, and Evaluator loop for this sprint."
        icon={<Wrench className="h-6 w-6" />}
        actions={
          <Button asChild variant="outline">
            <Link href="/harness">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to harness
            </Link>
          </Button>
        }
      />
      <PageContent>
        <HarnessRunConsole projectId={id} {...(sprintId ? { sprintId } : {})} />
      </PageContent>
    </PageShell>
  );
}
