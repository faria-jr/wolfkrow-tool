'use client';

import { Bot, FileText, Settings, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { NAV_GROUPS } from '@/lib/nav';

interface CommandEntry {
  label: string;
  url?: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect?: () => void;
}

// EPIC 2.2 — page entries are derived from the single nav config so the palette
// can't drift from the sidebar (it previously omitted the whole Tools group).
function pageEntries(): CommandEntry[] {
  return NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ label: item.title, url: item.url, group: group.label, icon: item.icon })),
  );
}

const ACTIONS: CommandEntry[] = [
  { label: 'New agent', url: '/agents', group: 'Actions', icon: Bot },
  { label: 'Run audit', url: '/audit', group: 'Actions', icon: ShieldAlert },
  { label: 'New provider', url: '/settings/providers', group: 'Actions', icon: Settings },
  { label: 'Toggle theme', group: 'Actions', icon: Sparkles, onSelect: () => { document.documentElement.classList.toggle('dark'); } },
  { label: 'Copy page URL', group: 'Actions', icon: FileText, onSelect: () => { if (typeof window !== 'undefined') void navigator.clipboard.writeText(window.location.href); } },
  { label: 'Reload page', group: 'Actions', icon: Zap, onSelect: () => { if (typeof window !== 'undefined') window.location.reload(); } },
];

const ENTRIES: CommandEntry[] = [...pageEntries(), ...ACTIONS];

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
                key={e.label + (e.url ?? '')}
                value={`${e.label} ${e.group}`}
                onSelect={() => {
                  setOpen(false);
                  if (e.onSelect) {
                    e.onSelect();
                  } else if (e.url) {
                    router.push(e.url);
                  }
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
