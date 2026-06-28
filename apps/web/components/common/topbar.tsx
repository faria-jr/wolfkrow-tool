'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { SidebarTrigger } from '@/components/ui/sidebar';

/**
 * Flush routes own their full-height header (chat/terminal/graph/design) — the
 * Topbar there is just a minimal strip with the sidebar toggle, no breadcrumb
 * (DEBT #13: eliminates the double header bar on those pages).
 */
const FLUSH_ROUTES = ['/chat', '/terminal', '/graph', '/design'];

function formatSegment(segment: string): string {
  // UUID-like (8-4-4-4-12) or long opaque id (>12 chars, no spaces).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
  const isOpaqueId = segment.length > 12 && /^[0-9a-z_-]+$/i.test(segment) && /\d/.test(segment);
  if (isUuid || isOpaqueId) return 'Details';
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Topbar({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname();
  const isFlush = FLUSH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumb = segments.length === 0 ? 'Dashboard' : segments.map(formatSegment).join(' / ');

  return (
    <header className="bg-background flex h-14 items-center justify-between border-b px-4">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <SidebarTrigger className="-ml-1" />
        {!isFlush && <span className="text-foreground font-medium">{breadcrumb}</span>}
      </div>
      {!isFlush && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
