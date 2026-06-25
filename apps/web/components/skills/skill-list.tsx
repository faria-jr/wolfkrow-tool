'use client';

import type { SkillProps } from '@wolfkrow/domain';
import { PencilIcon, TrashIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type SkillData = Omit<SkillProps, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };

interface SkillRowProps {
  skill: SkillData;
  onEdit: (s: SkillData) => void;
  onDelete: (s: SkillData) => void;
  disableDelete?: boolean;
}

function SkillRow({ skill, onEdit, onDelete, disableDelete }: SkillRowProps) {
  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{skill.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{skill.description}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {!skill.isBuiltIn && (
              <>
                <Button size="icon" variant="ghost" onClick={() => onEdit(skill)} aria-label="Edit skill"><PencilIcon className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(skill)} disabled={disableDelete} aria-label="Delete skill"><TrashIcon className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {skill.isBuiltIn && <Badge variant="secondary">built-in</Badge>}
          {skill.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
        </div>
      </CardContent>
    </Card>
  );
}

interface SkillListProps {
  skills: SkillData[];
  onEdit: (s: SkillData) => void;
  onDelete: (id: string) => Promise<void>;
}

export function SkillList({ skills, onEdit, onDelete }: SkillListProps) {
  const [toDelete, setToDelete] = useState<SkillData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = useCallback(async () => {
    if (!toDelete?.id) return;
    setDeleting(true);
    try { await onDelete(toDelete.id); }
    finally { setDeleting(false); setToDelete(null); }
  }, [toDelete, onDelete]);

  const cancelDelete = useCallback(() => setToDelete(null), []);

  if (skills.length === 0) return <p className="py-8 text-center text-muted-foreground">No skills yet. Create one to get started.</p>;
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {skills.map((s) => (
          <SkillRow key={s.id} skill={s} onEdit={onEdit} onDelete={setToDelete} disableDelete={deleting} />
        ))}
      </div>
      {toDelete && (
        <ConfirmDialog
          open
          title="Delete skill"
          description={`Delete ${toDelete.name}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => { void confirmDelete(); }}
          onCancel={cancelDelete}
        />
      )}
    </>
  );
}
