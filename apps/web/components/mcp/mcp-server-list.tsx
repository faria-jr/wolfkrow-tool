'use client';

import type { McpServerRecord, McpServerSource, McpServerVisibility } from '@wolfkrow/domain';
import { Network } from 'lucide-react';
import { memo, useState } from 'react';

import { ServerActions } from './mcp-server-actions';

import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  onDelete: (id: string) => void | Promise<void>;
  onEdit?: (id: string) => void;
  onRestart: (id: string) => void;
  onHealthCheck: (id: string) => void;
  onVisibilityChange: (id: string, visibility: McpServerVisibility) => void;
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

function ServerBadges({ server }: ServerBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
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
  onEdit,
  onRestart,
  onHealthCheck,
  onVisibilityChange,
}: RowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{server.name}</div>
          <p className="max-w-md truncate font-mono text-xs text-muted-foreground">
            {server.command} {server.args.join(' ')}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={sourceVariant(server.source)}>{sourceLabel(server.source)}</Badge>
      </TableCell>
      <TableCell>
        <ServerBadges server={server} />
      </TableCell>
      <TableCell>
        <ServerVisibilitySelect server={server} onVisibilityChange={onVisibilityChange} />
        {server.health?.lastError && (
          <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
            {server.health.lastError}
          </p>
        )}
      </TableCell>
      <TableCell>
        <ServerActions
          server={server}
          onToggle={onToggle}
          onDelete={onDelete}
          {...(onEdit ? { onEdit } : {})}
          onRestart={onRestart}
          onHealthCheck={onHealthCheck}
        />
      </TableCell>
    </TableRow>
  );
});

interface Props {
  servers: McpServerData[];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void | Promise<void>;
  onEdit?: (id: string) => void;
  onRestart: (id: string) => void;
  onHealthCheck: (id: string) => void;
  onVisibilityChange: (id: string, visibility: McpServerVisibility) => void;
}

const PAGE_SIZE = 5;

export function McpServerList({
  servers,
  onToggle,
  onDelete,
  onEdit,
  onRestart,
  onHealthCheck,
  onVisibilityChange,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  if (servers.length === 0)
    return (
      <EmptyState
        title="No MCP servers configured"
        description="Add a server to expose its tools to your agents."
        icon={<Network className="h-6 w-6" />}
      />
    );

  const totalPages = Math.ceil(servers.length / PAGE_SIZE);
  const paginatedServers = servers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead className="w-48" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedServers.map((s) => (
              <McpServerRow
                key={s.id}
                server={s}
                onToggle={onToggle}
                onDelete={onDelete}
                {...(onEdit ? { onEdit } : {})}
                onRestart={onRestart}
                onHealthCheck={onHealthCheck}
                onVisibilityChange={onVisibilityChange}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </>
  );
}
