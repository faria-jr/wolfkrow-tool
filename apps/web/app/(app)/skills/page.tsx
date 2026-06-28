import { Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { SkillsView } from '@/components/skills/skills-view';

export const metadata = { title: 'Skills' };

export default function SkillsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Skills"
        description="Reusable capabilities injected into agent system prompts."
        icon={<Sparkles className="h-6 w-6" />}
      />
      <PageContent>
        <SkillsView />
      </PageContent>
    </PageShell>
  );
}
