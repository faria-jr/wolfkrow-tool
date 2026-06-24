'use client';

import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { Bot, BookOpen, Calendar, Database, FileText, Folder, KeyRound, ListTodo, MessageSquare, Network, Settings, ShieldCheck, Sparkles, Workflow, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CommandEntry {
  label: string;
  url: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string[];
}

const ENTRIES: CommandEntry[] = [
  { label: 'Chat', url: '/chat', group: 'Main', icon: MessageSquare },
  { label: 'Agents', url: '/agents', group: 'Main', icon: Bot },
  { label: 'Skills', url: '/skills', group: 'Main', icon: Sparkles },
  { label: 'MCP Servers', url: '/mcp-servers', group: 'Main', icon: Network },
  { label: 'Knowledge', url: '/knowledge', group: 'Main', icon: BookOpen },
  { label: 'Graph', url: '/graph', group: 'Main', icon: Network },
  { label: 'Tasks', url: '/tasks', group: 'Main', icon: ListTodo },
  { label: 'Scheduler', url: '/scheduler', group: 'Automation', icon: Calendar },
  { label: 'Harness', url: '/harness', group: 'Automation', icon: Zap },
  { label: 'Pipeline', url: '/pipeline', group: 'Automation', icon: Workflow },
  { label: 'Memory', url: '/memory', group: 'Knowledge', icon: Database },
  { label: 'Rules', url: '/rules', group: 'Knowledge', icon: FileText },
  { label: 'Vault', url: '/vault', group: 'System', icon: KeyRound },
  { label: 'Channels', url: '/channels', group: 'System', icon: Folder },
  { label: 'Permissions', url: '/permissions', group: 'System', icon: ShieldCheck },
  { label: 'Settings', url: '/settings', group: 'System', icon: Settings },
  { label: 'Usage', url: '/usage', group: 'System', icon: FileText },
  { label: 'Logs', url: '/logs', group: 'System', icon: FileText },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const grouped = ENTRIES.reduce<Record<string, CommandEntry[]>>((acc, e) => {
    (acc[e.group] ??= []).push(e);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {Object.entries(grouped).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((e) => (
              <CommandItem
                key={e.url}
                value={`${e.label} ${e.group}`}
                onSelect={() => {
                  setOpen(false);
                  router.push(e.url);
                }}
              >
                <e.icon className="mr-2 h-4 w-4" />
                <span>{e.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
