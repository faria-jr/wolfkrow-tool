'use client';

import {
  BarChart3,
  Bot,
  BookOpen,
  Calendar,
  Database,
  FileText,
  Folder,
  KeyRound,
  ListTodo,
  MessageSquare,
  Network,
  PencilRuler,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wand2,
  Workflow,
  Zap,
} from 'lucide-react';
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

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MAIN_NAV: NavItem[] = [
  { title: 'Chat', url: '/chat', icon: MessageSquare },
  { title: 'Agents', url: '/agents', icon: Bot },
  { title: 'Skills', url: '/skills', icon: Sparkles },
  { title: 'MCP Servers', url: '/mcp-servers', icon: Network },
  { title: 'Knowledge', url: '/knowledge', icon: BookOpen },
  { title: 'Graph', url: '/graph', icon: Network },
  { title: 'Tasks', url: '/tasks', icon: ListTodo },
];

const AUTOMATION_NAV: NavItem[] = [
  { title: 'Scheduler', url: '/scheduler', icon: Calendar },
  { title: 'Harness', url: '/harness', icon: Zap },
  { title: 'Pipeline', url: '/pipeline', icon: Workflow },
  { title: 'Security Audit', url: '/audit', icon: ShieldAlert },
];

const TOOLS_NAV: NavItem[] = [
  { title: 'Design Studio', url: '/design', icon: PencilRuler },
  { title: 'Terminal', url: '/terminal', icon: TerminalSquare },
  { title: 'Enrich', url: '/enrich', icon: Wand2 },
];

const SYSTEM_NAV: NavItem[] = [
  { title: 'Memory', url: '/memory', icon: Database },
  { title: 'Rules', url: '/rules', icon: FileText },
  { title: 'Vault', url: '/vault', icon: KeyRound },
  { title: 'Channels', url: '/channels', icon: Folder },
  { title: 'Permissions', url: '/permissions', icon: ShieldCheck },
  { title: 'Usage', url: '/usage', icon: BarChart3 },
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'Logs', url: '/logs', icon: FileText },
];

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

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
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
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
        <span className="text-lg font-bold text-white">W</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">Wolfkrow</span>
        <span className="text-xs text-muted-foreground">v1.0.0</span>
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
        <NavGroup label="Main" items={MAIN_NAV} pathname={pathname} />
        <NavGroup label="Automation" items={AUTOMATION_NAV} pathname={pathname} />
        <NavGroup label="Tools" items={TOOLS_NAV} pathname={pathname} />
        <NavGroup label="System" items={SYSTEM_NAV} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>B
          </kbd>
          <span className="ml-2">Toggle sidebar</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </>
  );
}
