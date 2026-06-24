import {
  BarChart3,
  Bot,
  Calendar,
  FileText,
  Folder,
  KeyRound,
  Network,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import Link from 'next/link';

const SECTIONS = [
  { title: 'Providers', href: '/settings/providers', icon: Cpu, description: 'LLM providers and API configuration' },
  { title: 'Vault', href: '/vault', icon: KeyRound, description: 'API keys and secrets' },
  { title: 'Agents', href: '/agents', icon: Bot, description: 'Manage AI agents' },
  { title: 'MCP Servers', href: '/mcp-servers', icon: Network, description: 'Model Context Protocol servers' },
  { title: 'Scheduler', href: '/scheduler', icon: Calendar, description: 'Scheduled task automation' },
  { title: 'Rules', href: '/rules', icon: FileText, description: 'Behavioral rules and guidelines' },
  { title: 'Permissions', href: '/permissions', icon: ShieldCheck, description: 'Access control policies' },
  { title: 'Channels', href: '/channels', icon: Folder, description: 'Notification channels' },
  { title: 'Usage', href: '/usage', icon: BarChart3, description: 'Token analytics and costs' },
] as const;

export function SettingsView() {
  return (
    <div className="space-y-6">
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
