'use client';

import { useCallback } from 'react';
import type { Control } from 'react-hook-form';

import type { AgentFormValues } from './schema';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const PRESET_TOOLS = ['read_file', 'write_file', 'bash', 'grep', 'glob', 'web_search'] as const;

interface Props { control: Control<AgentFormValues>; }

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const addPreset = useCallback((tool: string) => {
    if (!value.includes(tool)) onChange([...value, tool]);
  }, [value, onChange]);

  const remove = useCallback((tool: string) => {
    onChange(value.filter((t) => t !== tool));
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = input.value.trim();
    if (v && !value.includes(v)) { onChange([...value, v]); input.value = ''; }
  }, [value, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((tool) => (
          <Badge key={tool} variant="secondary" className="cursor-pointer gap-1" onClick={() => remove(tool)}>{tool} ×</Badge>
        ))}
      </div>
      <Input placeholder="Type tool name + Enter" onKeyDown={handleKeyDown} />
      <div className="flex flex-wrap gap-1">
        {PRESET_TOOLS.map((tool) => (
          <Button key={tool} type="button" variant="outline" size="sm" onClick={() => addPreset(tool)} disabled={value.includes(tool)}>
            + {tool}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ToolsSection({ control }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Tools</h3>
      <FormField control={control} name="allowedTools" render={({ field }) => (
        <FormItem>
          <FormLabel>Allowed tools</FormLabel>
          <FormDescription className="text-xs">Tools this agent can use. Click badge to remove.</FormDescription>
          <TagInput value={field.value} onChange={field.onChange} />
        </FormItem>
      )} />
    </div>
  );
}
