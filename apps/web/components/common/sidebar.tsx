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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NAV_GROUPS, type NavItem } from '@/lib/nav';
import { APP_VERSION } from '@/lib/version';


/**
 * A nav item is active when the current pathname matches its route.
 * Top-level items use exact match; routes that own nested pages (e.g.
 * `/pipeline` owns `/pipeline/projects/[id]/report`, `/settings` owns
 * `/settings/voice`) stay highlighted while a descendant is shown.
 */
function isItemActive(pathname: string, url: string): boolean {
  if (pathname === url) return true;
  // Prefix match so nested routes highlight their parent nav item.
  // Guard against sibling collisions (e.g. /usage vs /users).
  return pathname.startsWith(`${url}/`);
}

function NavMenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isItemActive(pathname, item.url)}
        tooltip={item.title}
      >
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroup({ label, items, pathname }: { label: string; items: readonly NavItem[]; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavMenuItem key={item.url} item={item} pathname={pathname} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-md">
        <span className="text-lg font-bold text-primary-foreground">W</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">Wolfkrow</span>
        <span className="text-xs text-muted-foreground">v{APP_VERSION}</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.label} label={group.label} items={group.items} pathname={pathname} />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>B
          </kbd>
          <span className="ml-2">Toggle sidebar</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </>
  );
}
