'use client';

import { ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { SidebarTrigger } from '@/components/ui/sidebar';

function formatSegment(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Topbar({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumb = segments.length === 0 ? 'Dashboard' : segments.map(formatSegment).join(' / ');

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SidebarTrigger className="-ml-1" />
        <span className="font-medium text-foreground">Wolfkrow</span>
        <ChevronRight className="h-4 w-4" />
        <span>{breadcrumb}</span>
      </div>
      <div className="flex items-center gap-2">
        {actions}
      </div>
    </header>
  );
}
