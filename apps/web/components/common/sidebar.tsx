'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useSidebarCounts } from '@/hooks/use-sidebar-counts';
import { NAV_GROUPS, type NavItem } from '@/lib/nav';
import { APP_VERSION } from '@/lib/version';

const BADGE_KEYS: Record<string, string> = {
  '/agents': 'agents',
  '/skills': 'skills',
  '/mcp-servers': 'mcp',
};

function isItemActive(pathname: string, url: string): boolean {
  if (pathname === url) return true;
  return pathname.startsWith(`${url}/`);
}

function NavMenuItem({
  item,
  pathname,
  counts,
}: {
  item: NavItem;
  pathname: string;
  counts: Record<string, number>;
}) {
  const badgeKey = BADGE_KEYS[item.url];
  const count = badgeKey !== undefined ? counts[badgeKey] : undefined;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isItemActive(pathname, item.url)} tooltip={item.title}>
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {count !== undefined && count > 0 && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  counts,
}: {
  label: string;
  items: readonly NavItem[];
  pathname: string;
  counts: Record<string, number>;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavMenuItem key={item.url} item={item} pathname={pathname} counts={counts} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="from-primary to-accent flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br shadow-md">
        <span className="text-primary-foreground text-lg font-bold">W</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">Wolfkrow</span>
        <span className="text-muted-foreground text-xs">v{APP_VERSION}</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const counts = useSidebarCounts();

  return (
    <>
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.label}
            label={group.label}
            items={group.items}
            pathname={pathname}
            counts={counts}
          />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="text-muted-foreground px-2 py-1.5 text-xs">
          <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-xs font-medium">
            <span className="text-xs">⌘</span>B
          </kbd>
          <span className="ml-2">Toggle sidebar</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </>
  );
}
