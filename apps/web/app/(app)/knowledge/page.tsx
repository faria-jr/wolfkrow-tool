import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { KnowledgeView } from '@/components/knowledge/knowledge-view';

export const metadata = { title: 'Knowledge — Wolfkrow' };

export default function KnowledgePage() {
  return (
    <PageShell variant="narrow">
      <PageHeader
        title="Knowledge"
        description="Upload documents and search them with semantic + keyword search."
      />
      <PageContent>
        <KnowledgeView />
      </PageContent>
    </PageShell>
  );
}
