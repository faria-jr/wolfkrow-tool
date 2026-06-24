'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Sub-navigation shell for `/settings/*` sub-pages.
 *
 * NOTE: Settings is a navigation HUB — the index page (`settings-view.tsx`)
 * links to feature pages that live at their own top-level routes
 * (`/vault`, `/agents`, `/mcp-servers`, `/scheduler`, `/rules`,
 * `/permissions`, `/channels`, `/usage`). Only `/settings/providers` is a
 * genuine sub-route. This shell therefore renders only real, reachable
 * destinations — never dead `/settings/*` tabs (P0-5).
 */
const SETTINGS_TABS = [{ label: 'Providers', href: '/settings/providers' }] as const;

export function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6 p-6">
      <nav className="w-48 shrink-0 space-y-3">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted',
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
        <div className="space-y-1">
          {SETTINGS_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
