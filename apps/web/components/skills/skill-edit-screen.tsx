'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { SkillEditor, type SkillEditorValues } from './skill-editor';
import type { SkillData } from './skill-list';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  skillId: string;
}

async function fetchSkill(skillId: string): Promise<SkillData> {
  const res = await fetch(`/api/skills/${skillId}`, { credentials: 'include' });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to load skill (HTTP ${res.status})`);
  }
  const { skill } = (await res.json()) as { skill: SkillData };
  return skill;
}

async function saveSkill(skillId: string, values: SkillEditorValues): Promise<void> {
  const res = await fetch(`/api/skills/${skillId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
  }
}

function LoadingState() {
  return (
    <div className="text-muted-foreground flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading skill…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Could not load skill</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function SkillEditScreen({ skillId }: Props) {
  const router = useRouter();
  const [skill, setSkill] = useState<SkillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await fetchSkill(skillId);
        if (!cancelled) setSkill(loaded);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load skill');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skillId]);

  const save = async (values: SkillEditorValues) => {
    setSaving(true);
    try {
      await saveSkill(skillId, values);
      toast.success('Skill updated');
      router.push('/skills');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <SkillEditor
      {...(skill ? { initialValues: skill } : {})}
      onSave={save}
      onCancel={() => router.push('/skills')}
      loading={saving}
      saveLabel="Save changes"
    />
  );
}
