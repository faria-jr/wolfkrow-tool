'use client';

import type { Control } from 'react-hook-form';

import type { AgentFormValues } from './schema';

import { FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Props { control: Control<AgentFormValues>; }

export function ThinkingSection({ control }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Thinking</h3>
      <FormField control={control} name="thinking" render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
          <div>
            <FormLabel>Extended thinking</FormLabel>
            <FormDescription className="text-xs">Enables chain-of-thought reasoning</FormDescription>
          </div>
          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
        </FormItem>
      )} />
      <FormField control={control} name="thinkingBudget" render={({ field }) => (
        <FormItem>
          <FormLabel>Thinking budget (tokens)</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={100}
              placeholder="Leave blank for default"
              value={field.value ?? ''}
              onChange={(e) => { const v = e.target.value; field.onChange(v === '' ? undefined : Number(v)); }}
            />
          </FormControl>
        </FormItem>
      )} />
    </div>
  );
}
