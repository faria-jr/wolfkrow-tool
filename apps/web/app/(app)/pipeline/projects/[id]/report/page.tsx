import { PipelineReportView } from '@/components/pipeline/pipeline-report-view';

export const metadata = { title: 'Pipeline Report — Wolfkrow' };

interface PageProps { params: Promise<{ id: string }>; }

export default async function PipelineReportPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Pipeline Report</h1>
        <p className="text-muted-foreground">
          Consolidated Markdown report of every phase, message, and artifact for this pipeline.
        </p>
      </div>
      <PipelineReportView projectId={id} />
    </div>
  );
}
