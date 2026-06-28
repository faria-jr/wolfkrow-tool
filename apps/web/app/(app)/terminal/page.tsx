'use client';

import { SquareTerminal } from 'lucide-react';
import dynamic from 'next/dynamic';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { Skeleton } from '@/components/ui/skeleton';

// xterm + addons are client-only and heavy (~280 kB) — lazy-load so the
// terminal chunk never ships to other routes.
const Terminal = dynamic(() => import('@/components/terminal/terminal').then((m) => m.Terminal), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export default function TerminalPage() {
  return (
    <PageShell>
      <PageHeader
        title="Terminal"
        description="Interactive shell session"
        icon={<SquareTerminal className="h-6 w-6" />}
      />
      <PageContent className="overflow-hidden">
        <Terminal className="h-full" />
      </PageContent>
    </PageShell>
  );
}
