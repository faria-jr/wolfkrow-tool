import { Palette } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { DesignStudio } from '@/components/sidecar/design-studio';

export default function DesignPage() {
  return (
    <PageShell>
      <PageHeader title="Design Studio" description="Open Design — visual editor" icon={<Palette className="h-6 w-6" />} />
      <PageContent className="overflow-hidden">
        <DesignStudio />
      </PageContent>
    </PageShell>
  );
}
