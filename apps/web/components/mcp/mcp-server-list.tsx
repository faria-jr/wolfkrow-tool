'use client';

import type { McpServerRecord, McpServerSource, McpServerVisibility } from '@wolfkrow/domain';
import { Network, RotateCw, RefreshCw, TrashIcon } from 'lucide-react';
import { memo } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export type McpServerData = Omit<McpServerRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  /** Derived: where the server came from (catalog seed, planned, or user-added). */
  source: McpServerSource;
  /** Latest known health snapshot. Undefined when not yet probed. */
  health?: McpHealthSnapshot;
};

export interface McpHealthSnapshot {
  status: 'running' | 'stopped' | 'crashed';
  running: boolean;
  healthy: boolean;
  tools: number;
  restarts: number;
  lastError?: string;
  latencyMs?: number;
  checkedAt: number;
}

interface RowProps {
  server: McpServerData;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onRestart: (id: string) => void;
  onHealthCheck: (id: string) => void;
  onVisibilityChange: (id: string, visibility: McpServerVisibility) => void;
}

interface ServerActionsProps {
  server: McpServerData;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onRestart: (id: string) => void;
  onHealthCheck: (id: string) => void;
}

interface ServerBadgesProps {
  server: McpServerData;
}

interface ServerVisibilitySelectProps {
  server: McpServerData;
  onVisibilityChange: (id: string, visibility: McpServerVisibility) => void;
}

function sourceLabel(source: McpServerSource): string {
  if (source === 'built-in') return 'built-in';
  if (source === 'planned') return 'planned';
  return 'custom';
}

function sourceVariant(source: McpServerSource): 'secondary' | 'outline' | 'default' {
  if (source === 'built-in') return 'secondary';
  if (source === 'planned') return 'outline';
  return 'default';
}

function healthBadgeVariant(snapshot: McpHealthSnapshot | undefined): 'default' | 'secondary' | 'destructive' {
  if (!snapshot) return 'secondary';
  if (snapshot.healthy) return 'default';
  return 'destructive';
}

function healthLabel(snapshot: McpHealthSnapshot | undefined): string {
  if (!snapshot) return 'health: unknown';
  if (snapshot.healthy) return `health: ok (${snapshot.tools} tools)`;
  if (snapshot.status === 'crashed') return `health: crashed (${snapshot.restarts} restarts)`;
  return 'health: stopped';
}

function ServerActions({
  server,
  onToggle,
  onDelete,
  onRestart,
  onHealthCheck,
}: ServerActionsProps) {
  const showRestart = server.source === 'built-in';
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Switch
        checked={server.isActive}
        onCheckedChange={(v) => onToggle(server.id, v)}
        aria-label="Toggle active"
      />
      {showRestart && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onHealthCheck(server.id)}
          aria-label="Check health"
          title="Run health check"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      {showRestart && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onRestart(server.id)}
          aria-label="Restart server"
          title="Restart MCP server"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      )}
      {!server.isBuiltIn && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(server.id)}
          aria-label="Delete server"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function ServerBadges({ server }: ServerBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={sourceVariant(server.source)}>{sourceLabel(server.source)}</Badge>
      <Badge variant={server.isActive ? 'default' : 'outline'}>
        {server.isActive ? 'active' : 'inactive'}
      </Badge>
      <Badge variant={healthBadgeVariant(server.health)}>{healthLabel(server.health)}</Badge>
      {server.description && (
        <span className="text-xs text-muted-foreground">{server.description}</span>
      )}
    </div>
  );
}

function ServerVisibilitySelect({ server, onVisibilityChange }: ServerVisibilitySelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`visibility-${server.id}`} className="text-xs text-muted-foreground">
        Visibility:
      </label>
      <Select
        value={server.visibility}
        onValueChange={(v) => onVisibilityChange(server.id, v as McpServerVisibility)}
      >
        <SelectTrigger id={`visibility-${server.id}`} className="h-7 w-full sm:w-48 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="always">always (start on boot)</SelectItem>
          <SelectItem value="on-demand">on-demand (start when used)</SelectItem>
          <SelectItem value="background">background (silent worker)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

const McpServerRow = memo(function McpServerRow({
  server,
  onToggle,
  onDelete,
  onRestart,
  onHealthCheck,
  onVisibilityChange,
}: RowProps) {
  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{server.name}</CardTitle>
            <p className="truncate text-xs text-muted-foreground font-mono">
              {server.command} {server.args.join(' ')}
            </p>
          </div>
          <ServerActions
            server={server}
            onToggle={onToggle}
            onDelete={onDelete}
            onRestart={onRestart}
            onHealthCheck={onHealthCheck}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <ServerBadges server={server} />
        <ServerVisibilitySelect server={server} onVisibilityChange={onVisibilityChange} />
        {server.health?.lastError && (
          <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
            {server.health.lastError}
          </p>
        )}
      </CardContent>
    </Card>
  );
});

interface Props {
  servers: McpServerData[];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onRestart: (id: string) => void;
  onHealthCheck: (id: string) => void;
  onVisibilityChange: (id: string, visibility: McpServerVisibility) => void;
}

export function McpServerList({
  servers,
  onToggle,
  onDelete,
  onRestart,
  onHealthCheck,
  onVisibilityChange,
}: Props) {
  if (servers.length === 0)
    return (
      <EmptyState
        title="No MCP servers configured"
        description="Add a server to expose its tools to your agents."
        icon={<Network className="h-6 w-6" />}
      />
    );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {servers.map((s) => (
        <McpServerRow
          key={s.id}
          server={s}
          onToggle={onToggle}
          onDelete={onDelete}
          onRestart={onRestart}
          onHealthCheck={onHealthCheck}
          onVisibilityChange={onVisibilityChange}
        />
      ))}
    </div>
  );
}
