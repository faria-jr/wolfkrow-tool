'use client';

import { Bot, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { SkillData } from './skill-list';
import { SkillList } from './skill-list';

import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const API = '/api/skills';
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, { credentials: 'include', ...opts });
}
async function fetchSkills(): Promise<SkillData[]> {
  const res = await apiFetch(API);
  if (!res.ok) throw new Error('Failed to fetch skills');
  return ((await res.json()) as { skills: SkillData[] }).skills;
}

export function SkillsView() {
  const router = useRouter();
  const { skills, loading, error, loadSkills } = useSkillsData();
  const { duplicate, remove } = useSkillMutations(loadSkills);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push('/chat?agent=skill-creator')}
        >
          <Bot className="mr-2 h-4 w-4" />
          Criar com Assistente
        </Button>
        <Button onClick={() => router.push('/skills/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New skill
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
        <SkillList
          skills={skills}
          onEdit={(s) => router.push(`/skills/${s.id}/edit`)}
          onDuplicate={duplicate}
          onDelete={remove}
        />
      )}
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

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);
  return { skills, loading, error, loadSkills };
}

function useSkillMutations(loadSkills: () => Promise<void>) {
  const duplicate = useCallback(
    async (skill: SkillData) => {
      try {
        const res = await apiFetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${skill.name} copy`,
            description: skill.description,
            content: skill.content,
            tags: skill.tags,
          }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        toast.success('Skill duplicated');
        await loadSkills();
      } catch {
        toast.error('Failed to duplicate skill');
      }
    },
    [loadSkills]
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        toast.success('Skill deleted');
        await loadSkills();
      } catch {
        toast.error('Failed to delete skill');
      }
    },
    [loadSkills]
  );

  return { duplicate, remove };
}
