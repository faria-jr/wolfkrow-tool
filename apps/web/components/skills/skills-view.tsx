'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { SkillEditor, type SkillEditorValues } from './skill-editor';
import type { SkillData } from './skill-list';
import { SkillList } from './skill-list';

import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const API = '/api/skills';
async function apiFetch(path: string, opts?: RequestInit) { return fetch(path, { credentials: 'include', ...opts }); }
async function fetchSkills(): Promise<SkillData[]> {
  const res = await apiFetch(API);
  if (!res.ok) throw new Error('Failed to fetch skills');
  return ((await res.json()) as { skills: SkillData[] }).skills;
}

export function SkillsView() {
  const { skills, loading, error, loadSkills } = useSkillsData();
  const { modalOpen, setModalOpen, editing, setEditing, saving, save, remove } = useSkillMutations(loadSkills);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />New skill
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load skills"
          description={error.message}
          onRetry={() => void loadSkills()}
        />
      ) : (
        <SkillList skills={skills} onEdit={(s) => { setEditing(s); setModalOpen(true); }} onDelete={remove} />
      )}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit skill' : 'New skill'}</DialogTitle>
          </DialogHeader>
          <SkillEditor
            {...(editing ? { initialValues: { name: editing.name, description: editing.description, content: editing.content, tags: editing.tags } } : {})}
            onSave={save}
            onCancel={() => setModalOpen(false)}
            loading={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useSkillsData() {
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSkills(await fetchSkills());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load skills'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSkills(); }, [loadSkills]);
  return { skills, loading, error, loadSkills };
}

function useSkillMutations(loadSkills: () => Promise<void>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SkillData | null>(null);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (values: SkillEditorValues) => {
    setSaving(true);
    try {
      const method = editing?.id ? 'PUT' : 'POST';
      const path = editing?.id ? `${API}/${editing.id}` : API;
      const res = await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      toast.success('Skill saved');
      setModalOpen(false);
      await loadSkills();
    } catch {
      toast.error('Failed to save skill');
    } finally { setSaving(false); }
  }, [editing, loadSkills]);

  const remove = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      toast.success('Skill deleted');
      await loadSkills();
    } catch {
      toast.error('Failed to delete skill');
    }
  }, [loadSkills]);

  return { modalOpen, setModalOpen, editing, setEditing, saving, save, remove };
}
