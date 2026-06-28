import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { PipelineView } from '@/components/pipeline/pipeline-view';

export const metadata = { title: 'Pipeline — Wolfkrow' };

export default function PipelinePage() {
  return (
    <PageShell>
      <PageHeader
        title="Pipeline"
        description="Plan, execute and approve multi-stage AI pipelines."
      />
      <PageContent className="overflow-hidden">
        <PipelineView />
      </PageContent>
    </PageShell>
  );
}
