'use client';

import { Bot, Copy, Pencil, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';

import type { AgentData } from './agent-form-modal';
import { DeleteAgentDialog } from './delete-agent-dialog';

import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RowProps {
  agent: AgentData;
  onEdit: (agent: AgentData) => void;
  onDuplicate: (agent: AgentData) => void;
  onDelete: (agent: AgentData) => void;
  disableDelete?: boolean;
}

const AgentRow = memo(function AgentRow({
  agent,
  onEdit,
  onDuplicate,
  onDelete,
  disableDelete,
}: RowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{agent.name}</TableCell>
      <TableCell className="font-mono text-xs">{agent.model}</TableCell>
      <TableCell>{agent.runtime}</TableCell>
      <TableCell>
        <Badge variant={agent.isActive ? 'default' : 'secondary'}>
          {agent.isActive ? 'active' : 'inactive'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(agent)} aria-label="Edit agent">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(agent)}
            aria-label="Duplicate agent"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(agent)}
            disabled={disableDelete}
            aria-label="Delete agent"
          >
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

interface Props {
  agents: AgentData[];
  onEdit: (agent: AgentData) => void;
  onDuplicate: (agent: AgentData) => void;
  onDelete: (agentId: string) => Promise<void>;
}

function useDeleteConfirm(onDelete: (id: string) => Promise<void>) {
  const [toDelete, setToDelete] = useState<AgentData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = async () => {
    if (!toDelete?.id) return;
    setDeleting(true);
    try {
      await onDelete(toDelete.id);
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };
  return { toDelete, setToDelete, deleting, confirmDelete };
}

const PAGE_SIZE = 20;

export function AgentList({ agents, onEdit, onDuplicate, onDelete }: Props) {
  const { toDelete, setToDelete, deleting, confirmDelete } = useDeleteConfirm(onDelete);
  const [currentPage, setCurrentPage] = useState(1);

  if (agents.length === 0) {
    return (
      <EmptyState
        title="No agents yet"
        description="Create one to get started."
        icon={<Bot className="h-6 w-6" />}
      />
    );
  }

  const totalPages = Math.ceil(agents.length / PAGE_SIZE);
  const paginatedAgents = agents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Runtime</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAgents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={setToDelete}
                disableDelete={deleting}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      {toDelete && (
        <DeleteAgentDialog
          open
          agentName={toDelete.name}
          onClose={() => setToDelete(null)}
          onConfirm={confirmDelete}
          loading={deleting}
        />
      )}
    </>
  );
}
