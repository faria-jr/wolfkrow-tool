import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { PipelineReportView } from '@/components/pipeline/pipeline-report-view';

export const metadata = { title: 'Pipeline Report — Wolfkrow' };

interface PageProps { params: Promise<{ id: string }>; }

export default async function PipelineReportPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <PageShell>
      <PageHeader
        title="Pipeline Report"
        description="Consolidated Markdown report of every phase, message, and artifact for this pipeline."
        icon={<FileText className="h-6 w-6" />}
      />
      <PageContent>
        <PipelineReportView projectId={id} />
      </PageContent>
    </PageShell>
  );
}
