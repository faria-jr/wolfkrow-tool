import { Cpu, AudioLines, FolderOpen } from 'lucide-react';
import Link from 'next/link';

// EPIC 3.2 — Settings hub now only surfaces items that don't already have
// a sidebar entry. The 8 items previously duplicated here (Vault, Agents,
// MCP Servers, Scheduler, Rules, Permissions, Channels, Usage) live in
// NAV_GROUPS already; the hub exists only for /settings/providers and
// /settings/voice which are orphan routes inside the /settings segment.
const SECTIONS = [
  {
    title: 'Providers',
    href: '/settings/providers',
    icon: Cpu,
    description: 'LLM providers and API configuration',
  },
  {
    title: 'Voice',
    href: '/settings/voice',
    icon: AudioLines,
    description: 'STT/TTS engines and voice provider',
  },
  {
    title: 'Workspace data',
    href: '/vault',
    icon: FolderOpen,
    description: 'API keys and secrets (shortcut)',
  },
] as const;

export function SettingsView() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Workspace-wide settings. Page-level configuration (agents, skills, MCP, scheduler, rules,
        permissions, channels, usage) lives in the sidebar under its own entry.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ title, href, icon: Icon, description }) => (
          <Link
            key={href}
            href={href}
            className="bg-card hover:bg-accent flex items-start gap-3 rounded-lg border p-4 transition-colors"
          >
            <Icon className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-muted-foreground text-sm">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
