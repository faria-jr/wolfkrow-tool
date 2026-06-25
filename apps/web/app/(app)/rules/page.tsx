import { ScrollText } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { RulesEditor } from '@/components/rules/rules-editor';

export default function RulesPage() {
  return (
    <PageShell>
      <PageHeader title="Rules" description="Global rules injected into every prompt" icon={<ScrollText className="h-6 w-6" />} />
      <PageContent>
        <RulesEditor />
      </PageContent>
    </PageShell>
  );
}
