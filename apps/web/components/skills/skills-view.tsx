'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { SkillEditor, type SkillEditorValues } from './skill-editor';
import type { SkillData } from './skill-list';
import { SkillList } from './skill-list';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const API = '/api/skills';
async function apiFetch(path: string, opts?: RequestInit) { return fetch(path, { credentials: 'include', ...opts }); }
async function fetchSkills(): Promise<SkillData[]> {
  const res = await apiFetch(API);
  if (!res.ok) throw new Error('Failed to fetch skills');
  return ((await res.json()) as { skills: SkillData[] }).skills;
}

export function SkillsView() {
  const { skills, loadSkills } = useSkillsData();
  const { modalOpen, setModalOpen, editing, setEditing, saving, save, remove } = useSkillMutations(loadSkills);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />New skill
        </Button>
      </div>
      <SkillList skills={skills} onEdit={(s) => { setEditing(s); setModalOpen(true); }} onDelete={remove} />
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
  const loadSkills = useCallback(async () => {
    try { setSkills(await fetchSkills()); } catch { /* graceful */ }
  }, []);
  useEffect(() => { void loadSkills(); }, [loadSkills]);
  return { skills, loadSkills };
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
