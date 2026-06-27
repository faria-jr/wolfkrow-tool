/**
 * EPIC 2.2 — Single source of truth for app navigation.
 *
 * Both the Sidebar and the CommandPalette derive their page entries from this
 * config so the two surfaces can't drift (previously the palette was missing
 * the entire Tools group and used inconsistent icons). Dashboard is the app
 * landing route (EPIC 2.3); every icon is distinct to avoid the duplicate-icon
 * confusion the audit flagged (Network on MCP+Graph, FileText on Rules+Logs).
 */

import {
  BarChart3,
  Bot,
  BookOpen,
  Calendar,
  Database,
  FileText,
  Folder,
  FolderSearch,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Network,
  PencilRuler,
  ScrollText,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wand2,
  Wrench,
  Workflow,
} from 'lucide-react';

export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Main',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Chat', url: '/chat', icon: MessageSquare },
      { title: 'Agents', url: '/agents', icon: Bot },
      { title: 'Skills', url: '/skills', icon: Sparkles },
      { title: 'MCP Servers', url: '/mcp-servers', icon: Network },
      { title: 'Knowledge', url: '/knowledge', icon: BookOpen },
      { title: 'Graph', url: '/graph', icon: Share2 },
      { title: 'Tasks', url: '/tasks', icon: ListTodo },
    ],
  },
  {
    label: 'Automation',
    items: [
      { title: 'Scheduler', url: '/scheduler', icon: Calendar },
      { title: 'Harness', url: '/harness', icon: Wrench },
      { title: 'Pipeline', url: '/pipeline', icon: Workflow },
      { title: 'Security Audit', url: '/audit', icon: ShieldAlert },
    ],
  },
  {
    label: 'Tools',
    items: [
      { title: 'Design Studio', url: '/design', icon: PencilRuler },
      { title: 'Terminal', url: '/terminal', icon: TerminalSquare },
      { title: 'Enrich', url: '/enrich', icon: Wand2 },
      { title: 'Profiler', url: '/profiler', icon: FolderSearch },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Memory', url: '/memory', icon: Database },
      { title: 'Rules', url: '/rules', icon: ScrollText },
      { title: 'Vault', url: '/vault', icon: KeyRound },
      { title: 'Channels', url: '/channels', icon: Folder },
      { title: 'Permissions', url: '/permissions', icon: ShieldCheck },
      { title: 'Usage', url: '/usage', icon: BarChart3 },
      { title: 'Settings', url: '/settings', icon: Settings },
      { title: 'Logs', url: '/logs', icon: FileText },
    ],
  },
];

/** Flatten all nav items across groups (for the command palette + tests). */
export function flattenNav(groups: readonly NavGroup[]): readonly NavItem[] {
  return groups.flatMap((g) => g.items);
}
