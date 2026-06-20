'use client';

import {
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
  Settings,
  ShieldCheck,
  Sparkles,
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
  badge?: string;
};

const MAIN_NAV: NavItem[] = [
  { title: 'Chat', url: '/chat', icon: MessageSquare },
  { title: 'Agents', url: '/agents', icon: Bot },
  { title: 'Skills', url: '/skills', icon: Sparkles },
  { title: 'MCP Servers', url: '/mcp', icon: Network },
  { title: 'Knowledge', url: '/knowledge', icon: BookOpen },
  { title: 'Tasks', url: '/tasks', icon: ListTodo },
];

const AUTOMATION_NAV: NavItem[] = [
  { title: 'Scheduler', url: '/scheduler', icon: Calendar },
  { title: 'Harness', url: '/harness', icon: Zap },
  { title: 'Pipeline', url: '/pipeline', icon: Workflow },
];

const SYSTEM_NAV: NavItem[] = [
  { title: 'Memory', url: '/memory', icon: Database },
  { title: 'Rules', url: '/rules', icon: FileText },
  { title: 'Vault', url: '/vault', icon: KeyRound },
  { title: 'Channels', url: '/channels', icon: Folder },
  { title: 'Permissions', url: '/permissions', icon: ShieldCheck },
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'Logs', url: '/logs', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
            <span className="text-lg font-bold text-white">W</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Wolfkrow</span>
            <span className="text-xs text-muted-foreground">v1.0.0</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Automation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {AUTOMATION_NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SYSTEM_NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
