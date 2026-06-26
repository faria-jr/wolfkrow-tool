'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { SidebarTrigger } from '@/components/ui/sidebar';
function formatSegment(segment: string): string {
  // UUID-like (8-4-4-4-12) or long opaque id (>12 chars, no spaces).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
  const isOpaqueId = segment.length > 12 && /^[0-9a-z_-]+$/i.test(segment) && /\d/.test(segment);
  if (isUuid || isOpaqueId) return 'Details';
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
        <span className="font-medium text-foreground">{breadcrumb}</span>
      </div>
      <div className="flex items-center gap-2">
        {actions}
      </div>
    </header>
  );
}
