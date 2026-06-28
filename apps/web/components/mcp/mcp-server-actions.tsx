'use client';

import { Pencil, RotateCw, RefreshCw, TrashIcon } from 'lucide-react';
import { useState } from 'react';

import type { McpServerData } from './mcp-server-list';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface ServerActionsProps {
  server: McpServerData;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void | Promise<void>;
  onEdit?: (id: string) => void;
  onRestart: (id: string) => void;
  onHealthCheck: (id: string) => void;
}

function DeleteServerButton({
  server,
  onDelete,
}: {
  server: McpServerData;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeletion() {
    setDeleting(true);
    try {
      await onDelete(server.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setConfirmDelete(true)}
        disabled={deleting}
        aria-label="Delete server"
      >
        <TrashIcon className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete server"
        description={`Remove "${server.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void confirmDeletion()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export function ServerActions({
  server,
  onToggle,
  onDelete,
  onEdit,
  onRestart,
  onHealthCheck,
}: ServerActionsProps) {
  const showRestart = server.source === 'built-in';
  return (
    <div className="flex shrink-0 items-center gap-2">
      {onEdit && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onEdit(server.id)}
          aria-label="Edit server"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
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
      {!server.isBuiltIn && <DeleteServerButton server={server} onDelete={onDelete} />}
    </div>
  );
}
