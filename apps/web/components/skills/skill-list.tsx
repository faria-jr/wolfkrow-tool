'use client';

import type { SkillProps } from '@wolfkrow/domain';
import { CopyIcon, PencilIcon, Sparkles, TrashIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
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

export type SkillData = Omit<SkillProps, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

interface SkillRowProps {
  skill: SkillData;
  onEdit: (s: SkillData) => void;
  onDuplicate: (s: SkillData) => void;
  onDelete: (s: SkillData) => void;
  disableDelete?: boolean;
}

function SkillRow({ skill, onEdit, onDuplicate, onDelete, disableDelete }: SkillRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{skill.name}</div>
          <p className="text-muted-foreground max-w-md truncate text-sm">{skill.description}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {skill.tags.length > 0 ? (
            skill.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={skill.isBuiltIn ? 'secondary' : 'default'}>
          {skill.isBuiltIn ? 'built-in' : 'custom'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDuplicate(skill)}
            aria-label="Duplicate skill"
          >
            <CopyIcon className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onEdit(skill)} aria-label="Edit skill">
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(skill)}
            disabled={disableDelete || skill.isBuiltIn}
            aria-label="Delete skill"
          >
            <TrashIcon className="text-destructive h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface SkillListProps {
  skills: SkillData[];
  onEdit: (s: SkillData) => void;
  onDuplicate: (s: SkillData) => void;
  onDelete: (id: string) => Promise<void>;
}

const PAGE_SIZE = 5;

function SkillTable({
  skills,
  onEdit,
  onDuplicate,
  onDelete,
  deleting,
}: Omit<SkillListProps, 'onDelete'> & { onDelete: (s: SkillData) => void; deleting: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.map((s) => (
            <SkillRow
              key={s.id}
              skill={s}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              disableDelete={deleting}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SkillList({ skills, onEdit, onDuplicate, onDelete }: SkillListProps) {
  const [toDelete, setToDelete] = useState<SkillData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const confirmDelete = useCallback(async () => {
    if (!toDelete?.id) return;
    setDeleting(true);
    try {
      await onDelete(toDelete.id);
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }, [toDelete, onDelete]);

  const cancelDelete = useCallback(() => setToDelete(null), []);

  if (skills.length === 0) {
    return (
      <EmptyState
        title="No skills yet"
        description="Create one to get started."
        icon={<Sparkles className="h-6 w-6" />}
      />
    );
  }

  const totalPages = Math.ceil(skills.length / PAGE_SIZE);
  const paginatedSkills = skills.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <SkillTable
        skills={paginatedSkills}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={setToDelete}
        deleting={deleting}
      />
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      {toDelete && (
        <ConfirmDialog
          open
          title="Delete skill"
          description={`Delete ${toDelete.name}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            void confirmDelete();
          }}
          onCancel={cancelDelete}
        />
      )}
    </>
  );
}
