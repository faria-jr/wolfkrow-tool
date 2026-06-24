import { PageHeader } from '@/components/common/page-header';
import { PipelineView } from '@/components/pipeline/pipeline-view';

export const metadata = { title: 'Pipeline — Wolfkrow' };

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Pipeline" description="Plan, execute and approve multi-stage AI pipelines." />
      <div className="flex-1 overflow-hidden">
        <PipelineView />
      </div>
    </div>
  );
}
