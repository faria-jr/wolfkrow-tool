'use client';

import { useCallback } from 'react';
import type { Control } from 'react-hook-form';

import type { AgentFormValues } from './schema';

import { Badge } from '@/components/ui/badge';
import { FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface Props {
  control: Control<AgentFormValues>;
}

function SkillInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const remove = useCallback(
    (skill: string) => {
      onChange(value.filter((s) => s !== skill));
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const input = e.currentTarget;
      const v = input.value.trim();
      if (v && !value.includes(v)) {
        onChange([...value, v]);
        input.value = '';
      }
    },
    [value, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((skill) => (
          <Badge
            key={skill}
            variant="outline"
            className="cursor-pointer gap-1"
            onClick={() => remove(skill)}
          >
            {skill} ×
          </Badge>
        ))}
      </div>
      <Input placeholder="Type skill name + Enter" onKeyDown={handleKeyDown} />
    </div>
  );
}

export function SkillsSection({ control }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground text-sm font-medium">Skills</h3>
      <FormField
        control={control}
        name="skills"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Skills</FormLabel>
            <FormDescription className="text-xs">
              Capabilities injected into system prompt. Click badge to remove.
            </FormDescription>
            <SkillInput value={field.value} onChange={field.onChange} />
          </FormItem>
        )}
      />
    </div>
  );
}
