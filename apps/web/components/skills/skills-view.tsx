'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SkillData | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSkills = useCallback(async () => {
    try { setSkills(await fetchSkills()); } catch { /* graceful */ }
  }, []);

  useEffect(() => { void loadSkills(); }, [loadSkills]);

  const handleSave = useCallback(async (values: SkillEditorValues) => {
    setSaving(true);
    try {
      const method = editing?.id ? 'PUT' : 'POST';
      const path = editing?.id ? `${API}/${editing.id}` : API;
      await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      setModalOpen(false);
      await loadSkills();
    } finally { setSaving(false); }
  }, [editing, loadSkills]);

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    await loadSkills();
  }, [loadSkills]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />New skill
        </Button>
      </div>
      <SkillList skills={skills} onEdit={(s) => { setEditing(s); setModalOpen(true); }} onDelete={handleDelete} />
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit skill' : 'New skill'}</DialogTitle>
          </DialogHeader>
          <SkillEditor
            {...(editing ? { initialValues: { name: editing.name, description: editing.description, content: editing.content, tags: editing.tags } } : {})}
            onSave={handleSave}
            onCancel={() => setModalOpen(false)}
            loading={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
