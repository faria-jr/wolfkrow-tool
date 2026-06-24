'use client';

import { useWatch, type Control } from 'react-hook-form';

import type { AgentFormValues } from './schema';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] as const;
const EFFORTS = ['low', 'medium', 'high', 'max'] as const;
const RUNTIMES = ['cloud', 'local', 'codex', 'external', 'claude-compat'] as const;

const CLAUDE_COMPAT_PROVIDERS = [
  { value: 'zai', label: 'Z.ai (GLM)' },
  { value: 'minimax', label: 'MiniMax TokenPlan' },
  { value: 'moonshot', label: 'Moonshot (Kimi)' },
  { value: 'qwen', label: 'Qwen (DashScope)' },
] as const;

interface Props { control: Control<AgentFormValues>; }

function ModelField({ control }: Props) {
  return (
    <FormField control={control} name="model" render={({ field }) => (
      <FormItem>
        <FormLabel>Model</FormLabel>
        <Select onValueChange={field.onChange} value={field.value}>
          <FormControl><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger></FormControl>
          <SelectContent>{MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function EffortAndTurnsFields({ control }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField control={control} name="effort" render={({ field }) => (
        <FormItem>
          <FormLabel>Effort</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{EFFORTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="maxTurns" render={({ field }) => (
        <FormItem>
          <FormLabel>Max turns</FormLabel>
          <FormControl><Input type="number" min={1} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );
}

function ProviderField({ control }: Props) {
  return (
    <FormField control={control} name="provider" render={({ field }) => (
      <FormItem>
        <FormLabel>Provider</FormLabel>
        <Select onValueChange={field.onChange} value={field.value ?? ''}>
          <FormControl><SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger></FormControl>
          <SelectContent>
            {CLAUDE_COMPAT_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

export function ModelSection({ control }: Props) {
  const runtime = useWatch({ control, name: 'runtime' });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Model</h3>
      <ModelField control={control} />
      <EffortAndTurnsFields control={control} />
      <FormField control={control} name="runtime" render={({ field }) => (
        <FormItem>
          <FormLabel>Runtime</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{RUNTIMES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      {runtime === 'claude-compat' && <ProviderField control={control} />}
    </div>
  );
}
