'use client';

import { useEffect, useMemo } from 'react';
import { useFormContext, useWatch, type Control } from 'react-hook-form';

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
type Runtime = (typeof RUNTIMES)[number];

/** EPIC 1.1 — runtime → supported protocols for the provider selector.
 *  Matches the orchestration layer's SDK routing (see apps/worker/src/agent-factory.ts). */
const RUNTIME_PROTOCOLS: Record<Runtime, ReadonlyArray<ProviderDTO['protocol']>> = {
  cloud: ['anthropic-compat'],
  local: ['openai-compatible'],
  codex: ['openai-compatible'],
  external: ['openai-compatible'],
  'claude-compat': ['anthropic-compat'],
};

interface Props {
  control: Control<AgentFormValues>;
  providers?: ProviderDTO[];
}

function ModelField({ control, providers }: Props) {
  const selectedProvider = useWatch({ control, name: 'provider' });
  const currentModel = useWatch({ control, name: 'model' });
  const providerCfg = providers?.find((p) => p.id === selectedProvider);
  const models = providerCfg ? providerCfg.models : DEFAULT_MODELS;
  const { setValue } = useFormContext<AgentFormValues>();

  // EPIC 3.3 — when the provider changes, reset the model to the new provider's
  // first model if the currently-held model isn't offered by it (prevents
  // submitting a model that belongs to a different provider).
  useEffect(() => {
    if (models.length > 0 && !models.includes(currentModel ?? '')) {
      setValue('model', models[0]!, { shouldValidate: true });
    }
  }, [models, currentModel, setValue]);

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

function ProviderField({ control, providers, runtime }: Props & { runtime: Runtime }) {
  // EPIC 1.1 — provider selector is shown for every runtime, filtered by
  // supported protocols. For `claude-compat`, the direct `anthropic` entry is
  // excluded — routing through the compat layer with the upstream provider is
  // redundant. When `providers` is undefined we keep a graceful fallback only
  // for the `claude-compat` runtime (legacy behaviour); other runtimes render
  // an empty list until `/api/providers` resolves.
  const list = useMemo(() => {
    if (!providers) return runtime === 'claude-compat' ? FALLBACK_CLAUDE_COMPAT : [];
    const supported = RUNTIME_PROTOCOLS[runtime] ?? [];
    return providers.filter((p) => supported.includes(p.protocol) && !(runtime === 'claude-compat' && p.id === 'anthropic'));
  }, [providers, runtime]);

  return (
    <FormField control={control} name="provider" render={({ field }) => (
      <FormItem>
        <FormLabel>Provider</FormLabel>
        <Select onValueChange={field.onChange} value={field.value ?? ''}>
          <FormControl><SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger></FormControl>
          <SelectContent>
            {list.map((p) => (
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
      <EffortAndTurnsFields control={control} />
      <ProviderField control={control} runtime={runtime} {...(providers !== undefined ? { providers } : {})} />
      <ModelField control={control} {...(providers !== undefined ? { providers } : {})} />
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
    </div>
  );
}
