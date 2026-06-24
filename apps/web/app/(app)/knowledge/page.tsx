import { PageHeader } from '@/components/common/page-header';
import { KnowledgeView } from '@/components/knowledge/knowledge-view';

export const metadata = { title: 'Knowledge — Wolfkrow' };

export default function KnowledgePage() {
  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-6">
      <PageHeader title="Knowledge Base" description="Upload documents and search them with semantic + keyword search." />
      <KnowledgeView />
    </div>
  );
}
