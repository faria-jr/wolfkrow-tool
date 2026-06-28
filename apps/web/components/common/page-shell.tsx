'use client';

import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Canonical content shell for every page under `app/(app)`.
 *
 * Usage:
 *   <PageShell>
 *     <PageHeader title="…" description="…" />
 *     <PageContent>{view}</PageContent>
 *   </PageShell>
 *
 * Variants:
 *  - `default` (scroll page): full-width column with content padding; header
 *    pinned at top, body scrolls.
 *  - `narrow`  : `default` constrained to `max-w-content` (settings/knowledge).
 *  - `flush`   : full-bleed, no padding (chat/terminal/graph/design — views
 *    that manage their own layout).
 */
export type PageShellVariant = 'default' | 'narrow' | 'flush';

export interface PageShellProps {
  variant?: PageShellVariant;
  className?: string;
  children: ReactNode;
}

const SHELL_BASE = 'flex h-full flex-col';
const SHELL_DEFAULT = 'gap-6 p-4 sm:p-6';
const SHELL_NARROW = `mx-auto w-full max-w-content gap-6 p-4 sm:p-6`;

export function PageShell({ variant = 'default', className, children }: PageShellProps) {
  if (variant === 'flush') {
    return <div className={cn('h-full', className)}>{children}</div>;
  }

  const variantClass = variant === 'narrow' ? SHELL_NARROW : SHELL_DEFAULT;
  return <div className={cn(SHELL_BASE, variantClass, className)}>{children}</div>;
}

/**
 * Canonical scroll region rendered inside `PageShell`. The `min-h-0` lets the
 * flex child shrink so `overflow-auto` actually scrolls instead of expanding
 * the page.
 */
export interface PageContentProps {
  className?: string;
  as?: ElementType;
  children: ReactNode;
}

export function PageContent({ className, as, children }: PageContentProps) {
  const Tag = (as ?? 'div') as ElementType;
  return <Tag className={cn('min-h-0 flex-1 overflow-auto', className)}>{children}</Tag>;
}
