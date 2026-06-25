import { SquareTerminal } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { Terminal } from '@/components/terminal/terminal';

export default function TerminalPage() {
  return (
    <PageShell>
      <PageHeader title="Terminal" description="Interactive shell session" icon={<SquareTerminal className="h-6 w-6" />} />
      <PageContent className="overflow-hidden">
        <Terminal className="h-full" />
      </PageContent>
    </PageShell>
  );
}
