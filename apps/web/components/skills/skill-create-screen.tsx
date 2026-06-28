'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { SkillEditor, type SkillEditorValues } from './skill-editor';

async function createSkill(values: SkillEditorValues): Promise<void> {
  const res = await fetch('/api/skills', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Create failed (HTTP ${res.status})`);
  }
}

export function SkillCreateScreen() {
  const router = useRouter();

  const save = async (values: SkillEditorValues) => {
    try {
      await createSkill(values);
      toast.success('Skill created');
      router.push('/skills');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create skill');
    }
  };

  return (
    <SkillEditor onSave={save} onCancel={() => router.push('/skills')} saveLabel="Create skill" />
  );
}
