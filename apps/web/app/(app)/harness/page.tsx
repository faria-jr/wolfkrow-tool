import { Wrench } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { HarnessView } from '@/components/harness/harness-view';

export const metadata = { title: 'Harness — Wolfkrow' };

export default function HarnessPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Harness" description="Run tools and test agent behavior in a controlled environment." icon={<Wrench className="h-6 w-6" />} />
      <div className="flex-1 overflow-auto p-6">
        <HarnessView />
      </div>
    </div>
  );
}
