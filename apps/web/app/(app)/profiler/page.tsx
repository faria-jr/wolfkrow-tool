import { FolderSearch } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { ProfilerView } from '@/components/profiler/profiler-view';

export const metadata: Metadata = {
  title: 'Profiler',
  description: 'Profile a local repository: detect languages, frameworks and file roles.',
};

export default function ProfilerPage() {
  return (
    <PageShell>
      <PageHeader
        title="Profiler"
        description="Profile a local repository: detect languages, frameworks and file roles."
        icon={<FolderSearch className="h-6 w-6" />}
      />
      <PageContent>
        <ProfilerView />
      </PageContent>
    </PageShell>
  );
}
