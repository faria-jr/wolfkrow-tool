'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const SETTINGS_TABS = [
  { label: 'Providers', href: '/settings/providers' },
  { label: 'Vault', href: '/settings/vault' },
  { label: 'Agents', href: '/settings/agents' },
  { label: 'MCP', href: '/settings/mcp' },
  { label: 'Automation', href: '/settings/automation' },
  { label: 'Rules', href: '/settings/rules' },
  { label: 'Permissions', href: '/settings/permissions' },
  { label: 'Channels', href: '/settings/channels' },
  { label: 'Usage', href: '/settings/usage' },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6 p-6">
      <nav className="w-48 shrink-0 space-y-1">
        {SETTINGS_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'block rounded-md px-3 py-2 text-sm hover:bg-muted',
              pathname === tab.href && 'bg-muted font-medium',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
