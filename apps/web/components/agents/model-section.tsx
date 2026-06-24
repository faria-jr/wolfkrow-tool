'use client';

import { useWatch, type Control } from 'react-hook-form';

import type { AgentFormValues } from './schema';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ProviderDTO {
  id: string;
  displayName: string;
  protocol: 'anthropic-compat' | 'openai-compatible';
  baseUrl: string;
  apiKeyAccount: string;
  models: string[];
  supportsTools: boolean;
  pricingUrl?: string;
}

const DEFAULT_MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
const EFFORTS = ['low', 'medium', 'high', 'max'] as const;
const RUNTIMES = ['cloud', 'local', 'codex', 'external', 'claude-compat'] as const;

interface Props {
  control: Control<AgentFormValues>;
  providers?: ProviderDTO[];
}

function ModelField({ control, providers }: Props) {
  const selectedProvider = useWatch({ control, name: 'provider' });
  const providerCfg = providers?.find((p) => p.id === selectedProvider);
  const models = providerCfg ? providerCfg.models : DEFAULT_MODELS;

  return (
    <FormField control={control} name="model" render={({ field }) => (
      <FormItem>
        <FormLabel>Model</FormLabel>
        <Select onValueChange={field.onChange} value={field.value}>
          <FormControl><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger></FormControl>
          <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
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

const FALLBACK_CLAUDE_COMPAT = [
  { id: 'zai', displayName: 'Z.ai (GLM)' },
  { id: 'minimax', displayName: 'MiniMax TokenPlan' },
  { id: 'moonshot', displayName: 'Moonshot (Kimi)' },
  { id: 'qwen', displayName: 'Qwen (DashScope)' },
];

function ProviderField({ control, providers }: Props) {
  const claudeCompatProviders = providers
    ? providers.filter((p) => p.protocol === 'anthropic-compat' && p.id !== 'anthropic')
    : FALLBACK_CLAUDE_COMPAT;

  return (
    <FormField control={control} name="provider" render={({ field }) => (
      <FormItem>
        <FormLabel>Provider</FormLabel>
        <Select onValueChange={field.onChange} value={field.value ?? ''}>
          <FormControl><SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger></FormControl>
          <SelectContent>
            {claudeCompatProviders.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

export function ModelSection({ control, providers }: Props) {
  const runtime = useWatch({ control, name: 'runtime' });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Model</h3>
      <ModelField control={control} {...(providers !== undefined ? { providers } : {})} />
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
      {runtime === 'claude-compat' && <ProviderField control={control} {...(providers !== undefined ? { providers } : {})} />}
    </div>
  );
}
