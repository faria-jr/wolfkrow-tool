import { FolderKanban } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { ProjectsView } from '@/components/projects/projects-view';

export const metadata = { title: 'Projects — Wolfkrow' };

export default function ProjectsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Projects"
        description="Central project registration shared by Harness, Pipeline, Design Studio and Terminal."
        icon={<FolderKanban className="h-6 w-6" />}
      />
      <PageContent className="overflow-hidden">
        <ProjectsView />
      </PageContent>
    </PageShell>
  );
}
