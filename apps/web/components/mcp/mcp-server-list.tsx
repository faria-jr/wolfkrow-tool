'use client';

import type { McpServerRecord } from '@wolfkrow/infra';
import { TrashIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

export type McpServerData = Omit<McpServerRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

interface RowProps { server: McpServerData; onToggle: (id: string, active: boolean) => void; onDelete: (id: string) => void; }

function McpServerRow({ server, onToggle, onDelete }: RowProps) {
  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{server.name}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono">{server.command} {server.args.join(' ')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Switch checked={server.isActive} onCheckedChange={(v) => onToggle(server.id, v)} aria-label="Toggle active" />
            {!server.isBuiltIn && (
              <Button size="icon" variant="ghost" onClick={() => onDelete(server.id)} aria-label="Delete server">
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {server.isBuiltIn && <Badge variant="secondary">built-in</Badge>}
          <Badge variant={server.isActive ? 'default' : 'outline'}>{server.isActive ? 'active' : 'inactive'}</Badge>
          <Badge variant="outline">{server.visibility}</Badge>
          {server.description && <span className="text-xs text-muted-foreground">{server.description}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

interface Props { servers: McpServerData[]; onToggle: (id: string, active: boolean) => void; onDelete: (id: string) => void; }

export function McpServerList({ servers, onToggle, onDelete }: Props) {
  if (servers.length === 0) return <p className="py-8 text-center text-muted-foreground">No MCP servers configured.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {servers.map((s) => <McpServerRow key={s.id} server={s} onToggle={onToggle} onDelete={onDelete} />)}
    </div>
  );
}
